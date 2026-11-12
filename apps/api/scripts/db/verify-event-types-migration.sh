#!/usr/bin/env bash
# Verifies the event types EXPAND migration (20261110090000_event_types_catalog) on a THROWAWAY database.
# Builds a schema with every earlier tenant migration, inserts old-style events, applies the new migration, then checks backfill and triggers.
# Usage: PSQL="psql -X -q -v ON_ERROR_STOP=1 -d <scratch_db>" ./scripts/db/verify-event-types-migration.sh
# Never point it at a real school's database: it creates and drops two schemas named evtype_old and evtype_fresh.
set -euo pipefail
: "${PSQL:?set PSQL, e.g. PSQL='psql -X -q -v ON_ERROR_STOP=1 -d scratch_db'}"
M="$(cd "$(dirname "$0")/../../prisma/tenant-migrations" && pwd)"
NEW=20261110090000_event_types_catalog
run_schema() { local schema=$1; shift; for d in "$@"; do PGOPTIONS="-c search_path=$schema" $PSQL -1 -f "$M/$d/migration.sql" >/dev/null; done; }
sql() { PGOPTIONS="-c search_path=$1" $PSQL -At -c "$2"; }
fail() { echo "FAIL: $*"; exit 1; }
expect() { [ "$2" = "$3" ] || fail "$1: expected '$3' got '$2'"; }
expect_error() { local out; if out=$(PGOPTIONS="-c search_path=$1" $PSQL -At -c "$3" 2>&1); then fail "$2: statement should have been refused"; fi; echo "$out" | grep -q "$4" || fail "$2: wrong error: $out"; }

$PSQL -c "SET client_min_messages=warning; DROP SCHEMA IF EXISTS evtype_old CASCADE; DROP SCHEMA IF EXISTS evtype_fresh CASCADE; CREATE SCHEMA evtype_old; CREATE SCHEMA evtype_fresh;"
ALL=$(ls "$M" | grep -v toml)
BEFORE=$(echo "$ALL" | awk -v n="$NEW" '$0 < n')
AFTER=$(echo "$ALL" | awk -v n="$NEW" '$0 > n')   # later fixes (e.g. the id guard) apply on top of the expand migration

# --- existing school: old rows first, then the new migration
run_schema evtype_old $BEFORE
sql evtype_old "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",type,\"isHoliday\",status,\"updatedAt\") VALUES
 ('h1','Old holiday','2030-12-25','holiday',true,'PUBLISHED',now()),
 ('x1','Old exam','2030-12-01','exam',false,'PUBLISHED',now()),
 ('d1','Old draft','2030-12-02','meeting',false,'DRAFT',now()),
 ('c1','Old cancelled','2030-12-03','sports',false,'CANCELLED',now()),
 ('s1','Flagged exam','2030-12-04','exam',true,'PUBLISHED',now()),
 ('s2','Unflagged holiday','2030-12-06','holiday',false,'PUBLISHED',now())" >/dev/null
OUT=$(PGOPTIONS="-c search_path=evtype_old" $PSQL -1 -f "$M/$NEW/migration.sql" 2>&1)
echo "$OUT" | grep -q "1 flagged-holiday event(s) moved to the holiday type, 1 holiday-type event(s) flagged" || fail "preflight notice missing: $OUT"
[ -z "$AFTER" ] || run_schema evtype_old $AFTER
expect backfill "$(sql evtype_old "SELECT string_agg(id||':'||type||':'||(SELECT key FROM \"CalendarEventType\" WHERE id=\"eventTypeId\")||':'||\"isHoliday\", ',' ORDER BY id) FROM \"CalendarEvent\"")" \
  "c1:sports:sports:false,d1:meeting:meeting:false,h1:holiday:holiday:true,s1:holiday:holiday:true,s2:holiday:holiday:true,x1:exam:exam:false"
expect "status kept" "$(sql evtype_old "SELECT string_agg(id||status,',' ORDER BY id) FROM \"CalendarEvent\"")" "c1CANCELLED,d1DRAFT,h1PUBLISHED,s1PUBLISHED,s2PUBLISHED,x1PUBLISHED"

# --- fresh school: all migrations in order
run_schema evtype_fresh $ALL
for S in evtype_old evtype_fresh; do
  expect "$S catalog rows" "$(sql $S "SELECT count(*) FROM \"CalendarEventType\" WHERE \"isSystem\"")" 11
  expect "$S seed equals catalog" "$(sql $S "SELECT count(*) FROM \"CalendarEventType\" t JOIN event_type_system_catalog() c ON (c.id,c.key,c.name,c.\"nameKey\") = (t.id,t.key,t.name,t.\"nameKey\") WHERE t.\"isSystem\" AND t.\"isActive\"")" 11
  # Rule A
  expect_error $S "rename system" "UPDATE \"CalendarEventType\" SET name='Vacation', \"nameKey\"='vacation' WHERE key='holiday'" EVENT_TYPE_PROTECTED
  expect_error $S "deactivate system" "UPDATE \"CalendarEventType\" SET \"isActive\"=false WHERE key='exam'" EVENT_TYPE_PROTECTED
  expect_error $S "delete system" "DELETE FROM \"CalendarEventType\" WHERE key='exam'" EVENT_TYPE_PROTECTED
  expect_error $S "insert fake system" "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"isSystem\",\"updatedAt\") VALUES ('z1','fake','Fake','fake',true,now())" EVENT_TYPE_PROTECTED
  expect_error $S "insert system with wrong name" "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"isSystem\",\"updatedAt\") VALUES ('00000000-0000-4000-8000-000000000001','holiday','Holidays','holidays',true,now()) ON CONFLICT DO NOTHING" "EVENT_TYPE_PROTECTED"
  expect_error $S "custom with system key" "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"updatedAt\") VALUES ('z2','holiday','Day off','day off',now())" EVENT_TYPE_PROTECTED
  sql $S "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",color,icon,\"updatedAt\") VALUES ('cu1','inter-house-quiz','Inter-house Quiz','inter-house quiz','#12AB34','trophy',now())" >/dev/null
  expect_error $S "promote custom" "UPDATE \"CalendarEventType\" SET \"isSystem\"=true WHERE id='cu1'" EVENT_TYPE_PROTECTED
  expect_error $S "change a system type id" "UPDATE \"CalendarEventType\" SET id='00000000-0000-4000-8000-0000000000aa' WHERE key='exam'" EVENT_TYPE_PROTECTED
  expect_error $S "change a custom type id" "UPDATE \"CalendarEventType\" SET id='cu1-renamed' WHERE id='cu1'" EVENT_TYPE_PROTECTED
  expect "$S events keep their type after refused id change" "$(sql $S "SELECT count(*) FROM \"CalendarEvent\" WHERE \"eventTypeId\"='00000000-0000-4000-8000-000000000003'")" "$(sql $S "SELECT count(*) FROM \"CalendarEvent\" WHERE type='exam'")"
  expect_error $S "change key" "UPDATE \"CalendarEventType\" SET key='quiz' WHERE id='cu1'" EVENT_TYPE_PROTECTED
  expect_error $S "duplicate name ignoring case/spacing" "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"updatedAt\") VALUES ('cu2','sport-two','SPORTS','sports',now())" "nameKey"
  expect_error $S "bad colour" "UPDATE \"CalendarEventType\" SET color='red' WHERE id='cu1'" color_format
  expect_error $S "markup in name" "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"updatedAt\") VALUES ('cu3','xx','<b>Hi</b>','<b>hi</b>',now())" name_format
  sql $S "UPDATE \"CalendarEventType\" SET name='Quiz Day', \"nameKey\"='quiz day', color='#000000', \"isActive\"=false WHERE id='cu1'" >/dev/null   # custom: rename/recolour/deactivate allowed
  sql $S "UPDATE \"CalendarEventType\" SET color='#FF0000', icon='flag' WHERE key='exam'" >/dev/null                                              # system: colour and icon allowed
  # Rule B: insert paths
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",type,\"updatedAt\") VALUES ('i1','type only','2031-01-01','sports',now())" >/dev/null
  expect "$S type-only insert fills eventTypeId" "$(sql $S "SELECT \"eventTypeId\" FROM \"CalendarEvent\" WHERE id='i1'")" 00000000-0000-4000-8000-000000000007
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",\"updatedAt\") VALUES ('i2','custom','2031-01-01','cu1',now())" >/dev/null
  expect "$S custom insert mirrors as other" "$(sql $S "SELECT type||':'||\"isHoliday\" FROM \"CalendarEvent\" WHERE id='i2'")" other:false
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",type,\"updatedAt\") VALUES ('i3','both disagree','2031-01-01','00000000-0000-4000-8000-000000000003','sports',now())" >/dev/null
  expect "$S eventTypeId wins on insert" "$(sql $S "SELECT type FROM \"CalendarEvent\" WHERE id='i3'")" exam
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",\"isHoliday\",\"updatedAt\") VALUES ('i4','flag cannot make holiday','2031-01-01','00000000-0000-4000-8000-000000000003',true,now())" >/dev/null
  expect "$S isHoliday derived (flag ignored)" "$(sql $S "SELECT \"isHoliday\" FROM \"CalendarEvent\" WHERE id='i4'")" f
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",status,\"updatedAt\") VALUES ('i5','holiday by type','2031-01-01','00000000-0000-4000-8000-000000000001','PUBLISHED',now())" >/dev/null
  expect "$S holiday type => isHoliday" "$(sql $S "SELECT \"isHoliday\" FROM \"CalendarEvent\" WHERE id='i5'")" t
  # Rule B: update precedence (i2 is custom, mirror 'other')
  sql $S "UPDATE \"CalendarEvent\" SET type='other' WHERE id='i2'" >/dev/null
  expect "$S legacy type=other keeps custom type" "$(sql $S "SELECT \"eventTypeId\" FROM \"CalendarEvent\" WHERE id='i2'")" cu1
  sql $S "UPDATE \"CalendarEvent\" SET title='renamed' WHERE id='i2'" >/dev/null
  expect "$S unrelated update keeps custom type" "$(sql $S "SELECT \"eventTypeId\" FROM \"CalendarEvent\" WHERE id='i2'")" cu1
  sql $S "UPDATE \"CalendarEvent\" SET type='exam' WHERE id='i2'" >/dev/null
  expect "$S real legacy type change moves to system type" "$(sql $S "SELECT \"eventTypeId\"||':'||type FROM \"CalendarEvent\" WHERE id='i2'")" 00000000-0000-4000-8000-000000000003:exam
  sql $S "UPDATE \"CalendarEvent\" SET \"eventTypeId\"='cu1', type='sports' WHERE id='i2'" >/dev/null
  expect "$S eventTypeId wins when both change" "$(sql $S "SELECT \"eventTypeId\"||':'||type FROM \"CalendarEvent\" WHERE id='i2'")" cu1:other
  sql $S "UPDATE \"CalendarEvent\" SET \"eventTypeId\"=NULL WHERE id='i2'" >/dev/null
  expect "$S nulling eventTypeId restores it" "$(sql $S "SELECT \"eventTypeId\" FROM \"CalendarEvent\" WHERE id='i2'")" cu1
  # Published holiday lock (published i5 is holiday; make a published exam)
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",status,\"updatedAt\") VALUES ('p1','published exam','2031-02-01','00000000-0000-4000-8000-000000000003','PUBLISHED',now())" >/dev/null
  expect_error $S "published holiday -> other" "UPDATE \"CalendarEvent\" SET type='exam' WHERE id='i5'" EVENT_HOLIDAY_TYPE_LOCKED
  expect_error $S "published exam -> holiday" "UPDATE \"CalendarEvent\" SET \"eventTypeId\"='00000000-0000-4000-8000-000000000001' WHERE id='p1'" EVENT_HOLIDAY_TYPE_LOCKED
  sql $S "UPDATE \"CalendarEvent\" SET type='sports' WHERE id='p1'" >/dev/null            # non-holiday change on a published event is fine
  sql $S "UPDATE \"CalendarEvent\" SET status='CANCELLED' WHERE id='i5'" >/dev/null       # cancelling keeps the type
  sql $S "UPDATE \"CalendarEvent\" SET \"eventTypeId\"='00000000-0000-4000-8000-000000000003' WHERE id='i5'" >/dev/null   # cancelled events may change type
  sql $S "INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",status,\"updatedAt\") VALUES ('dr1','draft holiday','2031-03-01','00000000-0000-4000-8000-000000000001','DRAFT',now())" >/dev/null
  sql $S "UPDATE \"CalendarEvent\" SET \"eventTypeId\"='00000000-0000-4000-8000-000000000003', status='PUBLISHED' WHERE id='dr1'" >/dev/null   # drafts change freely
  # RESTRICT
  expect_error $S "delete type in use" "DELETE FROM \"CalendarEventType\" WHERE id='cu1'" "violates foreign key"
  sql $S "DELETE FROM \"CalendarEvent\" WHERE \"eventTypeId\"='cu1'" >/dev/null
  sql $S "DELETE FROM \"CalendarEventType\" WHERE id='cu1'" >/dev/null                     # unused custom type can go
done
# existing school: attendance-relevant rows unchanged by the migration
expect "old holiday still a published holiday" "$(sql evtype_old "SELECT count(*) FROM \"CalendarEvent\" WHERE \"isHoliday\" AND status='PUBLISHED' AND id IN ('h1','s1','s2')")" 3
$PSQL -c "SET client_min_messages=warning; DROP SCHEMA evtype_old CASCADE; DROP SCHEMA evtype_fresh CASCADE;" >/dev/null
echo "OK: event types expand migration verified (existing and fresh schema)"
