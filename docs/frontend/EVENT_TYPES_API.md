# Event types API: guide for the frontend

> **Branch:** `feat/api/events-calendar` · Base path `/events` (school realm, same auth as the rest of `/events`). Envelope: `{ success, message, data }`.
> Everything here is **additive** to the events API. A client that ignores `eventType` keeps working: `type` is still a string.

## 1. The idea

Every event has one **type**. A school gets 11 **system types** (below) and can add up to **50 custom types** of its own.
System types cannot be renamed, deactivated or deleted. Their **colour and icon can be changed**.

| key | name | | key | name |
|---|---|---|---|---|
| `holiday` | Holiday | | `meeting` | Meeting |
| `event` | Event | | `sports` | Sports |
| `exam` | Exam | | `ceremony` | Ceremony |
| `break` | Break | | `graduation` | Graduation |
| `other` | Other | | `resumption` | Resumption |
| | | | `pta` | PTA |

`key` is the stable identifier (code branches on it, never on `name`). A custom type gets its key from its name when created (`"Inter-house Quiz"` → `inter-house-quiz`, or `inter-house-quiz-2` on a clash) and it never changes, even if the type is renamed.
Only the **holiday** type makes a holiday (attendance skips those days). A custom type named "Holiday Fun" is not a holiday.

## 2. Endpoints

| | Who | |
|---|---|---|
| `GET /events/types` | any signed-in school person | Active types. Fill the type dropdown and the calendar legend from this. |
| `GET /events/types?includeInactive=true` | `events.types.manage` (School Admin) | Also inactive types. **403** for anyone else. |
| `POST /events/types` | `events.types.manage` | Body `{ name, color?, icon? }` → `201` with the type. |
| `PATCH /events/types/:typeId` | `events.types.manage` | Body: any of `{ name?, color?, icon?, isActive? }` (at least one). Send `color: null` or `icon: null` to clear. |
| `DELETE /events/types/:typeId` | `events.types.manage` | Only a custom type that no event uses. |

Type object: `{ id, key, name, color, icon, isSystem, isActive, createdAt, updatedAt }`. Show "Manage event types" only when the user has `events.types.manage` (the School Admin; Principals do not have it).

Rules: `name` 2–40 characters, no `<` `>`; two names that differ only by case or spacing are the same name. `color` is `#RRGGBB`. `icon` is an id from your icon set: lowercase letters, digits, hyphens (max 40). Unknown body fields (`key`, `id`, `isSystem`) are rejected with 400.

**Deactivate instead of delete** when events use a type: old events keep their label, and the type disappears from the dropdown. Reactivate any time.

## 3. Events

Create and update take the type as **`type` (a key)** or **`eventTypeId`** (send one, not both). No type means `event`.

```json
POST /events   { "title": "Quiz night", "type": "inter-house-quiz", "startDate": "2027-02-10", ... }
```

Event responses now carry both (`type` is the key, so existing code keeps working):

```json
{ "type": "inter-house-quiz",
  "eventType": { "id": "…", "key": "inter-house-quiz", "name": "Inter-house Quiz", "color": "#1A73E8", "icon": "trophy", "isSystem": false, "isActive": true },
  "isHoliday": false, … }
```

* `GET /events?type=<key>` or `?eventTypeId=<id>` filters by type.
* **`isHoliday` is read-only now.** Do not send it on `POST`/`PATCH /events` (400, unknown field). It is true exactly when the type is `holiday`. A holiday must be school-wide (everyone, no branch or class narrowing).
* An event may keep a type that was deactivated later (`eventType.isActive: false`: show it, maybe greyed). You cannot choose an inactive type for a new event or move an event to one.
* Use `eventType.color` and `eventType.icon` for the calendar chip. They can be `null`: fall back to your own default per `key`.
* Managers (`events.manage` / `events.publish`) also get `publishNoticeSentAt` and `reminders: { pending, sent, skipped, failed, cancelled }` (this revision) on every event response. Others do not get these two fields.

## 4. Error codes

| status | `code` | when |
|---|---|---|
| 400 | `EVENT_TYPE_UNKNOWN` | the `type` / `eventTypeId` on an event does not exist |
| 400 | `EVENT_HOLIDAY_NOT_SCHOOL_WIDE` | holiday type with a narrowed audience |
| 400 | `EVENT_HOLIDAY_REQUIRES_HOLIDAY_TYPE` | old calendar routes only: `isHoliday: true` with a non-holiday type |
| 403 | `FORBIDDEN` | `includeInactive` or a write without `events.types.manage` |
| 404 | `NOT_FOUND` | type id not in this school |
| 409 | `EVENT_TYPE_NAME_TAKEN` | same name already used (system names included) |
| 409 | `EVENT_TYPE_PROTECTED` | renaming, deactivating or deleting a system type |
| 409 | `EVENT_TYPE_IN_USE` | deleting a type events use (`details.events` = how many). Deactivate it instead |
| 409 | `EVENT_TYPE_INACTIVE` | choosing an inactive type for an event |
| 409 | `EVENT_TYPE_LIMIT` | 50 custom types reached (inactive ones count; deleting one frees a slot) |
| 409 | `EVENT_HOLIDAY_TYPE_LOCKED` | a **published** event cannot change to or from `holiday` (cancel it and create a new one). Drafts can |

## 5. The old calendar routes (`/sessions/calendar/events`)

Unchanged request and response shapes, with two differences: a custom type shows as `"other"` there, and `isHoliday: true` with a non-holiday type is now a 400 (`EVENT_HOLIDAY_REQUIRES_HOLIDAY_TYPE`) instead of being quietly accepted. Moving a published event to or from `holiday` is a 409 here too. New screens should use `/events`.

## 6. Existing events

All existing events were moved to the matching system type, with no change in how they look or behave. Any event that was flagged as a holiday without the holiday type was normalised during the migration.
