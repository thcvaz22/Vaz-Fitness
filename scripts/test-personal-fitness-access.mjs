import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source=file=>readFileSync(file,'utf8');

test('personal and fitness use the same credential record',()=>{
  const personalAuth=source('api/personal-auth.js');
  assert.match(personalAuth,/ensureSelfCoachedAccess\(sql,row\.id\)/);
  assert.match(personalAuth,/UPDATE vf_users SET password_salt=/);
});

test('approved personal receives an automatically approved self access',()=>{
  const helper=source('lib/self-coached-access.js');
  assert.match(helper,/VALUES \(\$\{userId\},\$\{userId\},'approved'/);
  assert.match(helper,/personal_id=EXCLUDED\.personal_id/);
  assert.match(helper,/status='approved'/);
});

test('fitness APIs accept both athlete and personal roles',()=>{
  const api=source('api/vf.js');
  assert.match(api,/authenticate\(req,\['athlete','personal'\]\)/);
  assert.match(api,/selfCoached:row\.role==='personal'/);
  assert.match(api,/profileRequired:row\.role==='personal'/);
  assert.match(api,/status=CASE WHEN \$\{selfCoached\} THEN 'approved'/);
});

test('personal self access does not consume a student seat',()=>{
  const plan=source('lib/personal-plan-handler.js');
  const admin=source('lib/admin-handler.js');
  assert.match(plan,/a\.athlete_id<>a\.personal_id/);
  assert.match(admin,/aa\.athlete_id<>aa\.personal_id/);
});

test('fitness entry supports personal first-use onboarding',()=>{
  const entry=source('app-auth-entry-v8.js');
  assert.match(entry,/\['athlete','personal'\]\.includes\(data\.user\?\.role\)/);
  assert.match(entry,/self-onboarding/);
  assert.match(entry,/finishSelfOnboarding/);
  assert.match(entry,/api\('submit_profile'/);
});

test('AION and Strava session guard allow approved personal access',()=>{
  const session=source('lib/session-auth.js');
  assert.match(session,/roles:\['athlete','personal'\]/);
  assert.match(session,/ensureSelfCoachedAccess\(auth\.sql,auth\.user\.id\)/);
});

test('self profile stays out of billable client lists',()=>{
  assert.match(source('api/vf.js'),/WHERE a\.personal_id=\$\{auth\.user\.id\} AND u\.role='athlete'/);
  assert.match(source('api/personal-ops.js'),/a\.athlete_id<>a\.personal_id/);
});
