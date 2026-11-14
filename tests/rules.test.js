import {test} from 'node:test';import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,deleteDoc} from 'firebase/firestore';import {empty} from '../src/model.js';
import {onSnapshot,runTransaction} from 'firebase/firestore';
import assert from 'node:assert/strict';
test('같은 UID의 독립 클라이언트가 저장 변경을 수신하고 오래된 버전은 덮어쓰지 않는다', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-bbo-isolation',firestore:{rules:await readFile('firestore.rules','utf8')}});
 const path=['users','sync-test','ledgers','main'];
 const pc=env.authenticatedContext('sync-test').firestore(),phone=env.authenticatedContext('sync-test').firestore();
 let stop,timer;
 try{
   const received=new Promise((resolve,reject)=>{
     timer=setTimeout(()=>reject(new Error('동기화 시간 초과')),15000);
     stop=onSnapshot(doc(phone,...path),s=>{if(s.data()?.version===2)resolve(s.data());},reject);
   });
   const first={version:1,updatedAt:new Date().toISOString(),data:empty()};
   await setDoc(doc(pc,...path),first);
   await runTransaction(pc,async tx=>{
     const ref=doc(pc,...path),s=await tx.get(ref),data=s.data().data;
     data.entries.test={date:'2026-01-01',amount:162000,deleted:false};
     tx.set(ref,{...first,version:2,data});
   });
   assert.equal((await received).data.entries.test.amount,162000);
   await assertFails(setDoc(doc(phone,...path),{...first,version:2}));
   assert.equal((await getDoc(doc(pc,...path))).data().data.entries.test.amount,162000);
 }finally{clearTimeout(timer);stop?.();await env.cleanup();}
});
test('UID 보안: 익명·다른 계정 읽기/쓰기 거부, 소유자 허용, 삭제 거부', {skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{const env=await initializeTestEnvironment({projectId:'demo-bbo-isolation',firestore:{rules:await readFile('firestore.rules','utf8')}});try{const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore(),anon=env.unauthenticatedContext().firestore();const path=['users','alice','ledgers','main'];const data={version:1,data:empty(),updatedAt:new Date().toISOString()};await assertSucceeds(setDoc(doc(a,...path),data));await assertSucceeds(getDoc(doc(a,...path)));await assertFails(getDoc(doc(b,...path)));await assertFails(setDoc(doc(b,...path),{...data,version:2}));await assertFails(getDoc(doc(anon,...path)));await assertFails(setDoc(doc(anon,...path),data));await assertFails(deleteDoc(doc(a,...path)));await assertFails(setDoc(doc(a,...path),{...data,version:3}));await assertSucceeds(setDoc(doc(a,...path),{...data,version:2}));await assertFails(getDoc(doc(b,'users','alice','backups','test')));}finally{await env.cleanup();}});
