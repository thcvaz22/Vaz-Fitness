// Gives an approved personal a private Vaz Fitness profile without creating
// another credential or consuming one of the commercial student seats.
export async function ensureSelfCoachedAccess(sql,userId){
  if(!sql||!userId)return null;
  await sql`INSERT INTO vf_cloud_state (user_id,state) VALUES (${userId},'{}'::jsonb) ON CONFLICT (user_id) DO NOTHING`;
  const existing=await sql`SELECT athlete_id,personal_id,status,profile_submitted_at,approved_at,suspended_reason,updated_at
    FROM vf_athlete_access WHERE athlete_id=${userId} LIMIT 1`;
  if(existing[0]?.personal_id===userId&&existing[0]?.status==='approved')return existing[0];
  const rows=await sql`INSERT INTO vf_athlete_access (athlete_id,personal_id,status,approved_at,updated_at)
    VALUES (${userId},${userId},'approved',now(),now())
    ON CONFLICT (athlete_id) DO UPDATE SET
      personal_id=EXCLUDED.personal_id,
      status='approved',
      approved_at=COALESCE(vf_athlete_access.approved_at,now()),
      suspended_reason=NULL,
      updated_at=now()
    RETURNING athlete_id,personal_id,status,profile_submitted_at,approved_at,suspended_reason,updated_at`;
  return rows[0]||null;
}
