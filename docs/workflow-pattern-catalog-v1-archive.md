# HubSpot v4 Workflow Pattern Catalog

Extracted from 12 production workflows. All real values replaced with placeholders.

---

## 1. ENROLLMENT PATTERNS

### 1A. LIST_BASED — Property Match (Simple AND)

Enroll when ALL conditions are true on the enrolled object.
Used in: Closed Won (deal stage + pipeline).

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "listFilterBranch": {
      "filterBranches": [],
      "filters": [
        {
          "property": "{property_name_1}",
          "operation": {
            "operator": "IS_ANY_OF",
            "includeObjectsWithNoValueSet": false,
            "values": ["{value_1}"],
            "operationType": "ENUMERATION"
          },
          "filterType": "PROPERTY"
        },
        {
          "property": "{property_name_2}",
          "operation": {
            "operator": "IS_ANY_OF",
            "includeObjectsWithNoValueSet": false,
            "values": ["{value_2}"],
            "operationType": "ENUMERATION"
          },
          "filterType": "PROPERTY"
        }
      ],
      "filterBranchType": "AND",
      "filterBranchOperator": "AND"
    },
    "unEnrollObjectsNotMeetingCriteria": false,
    "type": "LIST_BASED"
  }
}
```

### 1B. LIST_BASED — OR > AND Structure (Multiple Conditions)

Enroll when ANY of the AND groups match. This is the standard structure for complex enrollment.
Used in: Deal Lost (multiple deal type/stage combinations).

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "listFilterBranch": {
      "filterBranches": [
        {
          "filterBranches": [],
          "filters": [
            {
              "property": "{property_name_1}",
              "operation": {
                "operator": "IS_ANY_OF",
                "includeObjectsWithNoValueSet": false,
                "values": ["{value_a}"],
                "operationType": "ENUMERATION"
              },
              "filterType": "PROPERTY"
            },
            {
              "property": "{property_name_2}",
              "operation": {
                "operator": "IS_ANY_OF",
                "includeObjectsWithNoValueSet": false,
                "values": ["{value_b}"],
                "operationType": "ENUMERATION"
              },
              "filterType": "PROPERTY"
            }
          ],
          "filterBranchType": "AND",
          "filterBranchOperator": "AND"
        },
        {
          "filterBranches": [],
          "filters": [
            {
              "property": "{property_name_1}",
              "operation": {
                "operator": "IS_ANY_OF",
                "includeObjectsWithNoValueSet": false,
                "values": ["{value_c}"],
                "operationType": "ENUMERATION"
              },
              "filterType": "PROPERTY"
            }
          ],
          "filterBranchType": "AND",
          "filterBranchOperator": "AND"
        }
      ],
      "filters": [],
      "filterBranchType": "OR",
      "filterBranchOperator": "OR"
    },
    "unEnrollObjectsNotMeetingCriteria": false,
    "type": "LIST_BASED"
  }
}
```

### 1C. LIST_BASED — With ASSOCIATION Sub-Branch

Enroll based on properties of an associated object (e.g., company enrolls when associated deal has a specific property).
Used in: CX To-Do (company checks deal go_live_date), Deal Lost (deal checks company playbook status).

```json
{
  "listFilterBranch": {
    "filterBranches": [
      {
        "filterBranches": [
          {
            "filterBranches": [],
            "filters": [
              {
                "property": "{associated_object_property}",
                "operation": {
                  "operator": "IS_KNOWN",
                  "includeObjectsWithNoValueSet": false,
                  "operationType": "ALL_PROPERTY"
                },
                "filterType": "PROPERTY"
              }
            ],
            "objectTypeId": "{associated_object_type}",
            "operator": "IN_LIST",
            "associationTypeId": {association_type_id},
            "associationCategory": "HUBSPOT_DEFINED",
            "filterBranchType": "ASSOCIATION",
            "filterBranchOperator": "AND"
          }
        ],
        "filters": [
          {
            "property": "{enrolled_object_property}",
            "operation": {
              "operator": "IS_ANY_OF",
              "includeObjectsWithNoValueSet": false,
              "values": ["{value}"],
              "operationType": "ENUMERATION"
            },
            "filterType": "PROPERTY"
          }
        ],
        "filterBranchType": "AND",
        "filterBranchOperator": "AND"
      }
    ],
    "filters": [],
    "filterBranchType": "OR",
    "filterBranchOperator": "OR"
  }
}
```

**Association Type IDs observed:**
- `2` = Contact → Company (standard)
- `3` = Deal → Contact (standard)
- `8` = Company → Task (for task associations)
- `280` = Contact → Company (primary)
- `341` = Deal → Company (standard)
- `342` = Company → Deal (reverse)

### 1D. LIST_BASED — Date-Based (TIME_RANGED)

Enroll when a date property falls within a relative range (e.g., "within next 90 days").
Used in: MSA Renewal (agreement expiry within 90 days).

```json
{
  "listFilterBranch": {
    "filterBranches": [
      {
        "filterBranches": [],
        "filters": [
          {
            "property": "{date_property}",
            "operation": {
              "operator": "IS_BETWEEN",
              "includeObjectsWithNoValueSet": false,
              "lowerBoundEndpointBehavior": "INCLUSIVE",
              "upperBoundEndpointBehavior": "INCLUSIVE",
              "propertyParser": "VALUE",
              "lowerBoundTimePoint": {
                "timezoneSource": "CUSTOM",
                "zoneId": "UTC",
                "indexReference": {
                  "referenceType": "NOW"
                },
                "timeType": "INDEXED"
              },
              "upperBoundTimePoint": {
                "timezoneSource": "CUSTOM",
                "zoneId": "UTC",
                "indexReference": {
                  "referenceType": "TODAY"
                },
                "offset": {
                  "days": {number_of_days}
                },
                "timeType": "INDEXED"
              },
              "operationType": "TIME_RANGED",
              "type": "TIME_RANGED"
            },
            "filterType": "PROPERTY"
          }
        ],
        "filterBranchType": "AND",
        "filterBranchOperator": "AND"
      }
    ],
    "filters": [],
    "filterBranchType": "OR",
    "filterBranchOperator": "OR"
  }
}
```

### 1E. LIST_BASED — Date-Based (TIME_POINT + TIME_RANGED combo)

Enroll when a date is BEFORE a point AND BETWEEN a range. Used for anniversary-type logic ("go_live_date was ~358 days ago").
Used in: 12 Month Anniversary.

```json
{
  "filters": [
    {
      "property": "{date_property}",
      "operation": {
        "operator": "IS_BEFORE",
        "includeObjectsWithNoValueSet": false,
        "timePoint": {
          "timezoneSource": "CUSTOM",
          "zoneId": "UTC",
          "indexReference": {
            "referenceType": "TODAY"
          },
          "offset": {
            "days": -{days_ago_minimum}
          },
          "timeType": "INDEXED"
        },
        "endpointBehavior": "EXCLUSIVE",
        "propertyParser": "VALUE",
        "operationType": "TIME_POINT",
        "type": "TIME_POINT"
      },
      "filterType": "PROPERTY"
    },
    {
      "property": "{date_property}",
      "operation": {
        "operator": "IS_BETWEEN",
        "includeObjectsWithNoValueSet": false,
        "lowerBoundEndpointBehavior": "INCLUSIVE",
        "upperBoundEndpointBehavior": "INCLUSIVE",
        "propertyParser": "VALUE",
        "lowerBoundTimePoint": {
          "timezoneSource": "CUSTOM",
          "zoneId": "UTC",
          "indexReference": {
            "referenceType": "TODAY"
          },
          "offset": {
            "days": -{days_ago_range_start}
          },
          "timeType": "INDEXED"
        },
        "upperBoundTimePoint": {
          "timezoneSource": "CUSTOM",
          "zoneId": "UTC",
          "indexReference": {
            "referenceType": "NOW"
          },
          "timeType": "INDEXED"
        },
        "operationType": "TIME_RANGED",
        "type": "TIME_RANGED"
      },
      "filterType": "PROPERTY"
    }
  ]
}
```

### 1F. EVENT_BASED — Property Change Trigger

Enroll when a specific property changes on the object. Uses UNIFIED_EVENTS with refinement criteria.
Used in: Deal Servers > Company Servers (enroll deal when number_of_servers changes).

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "eventFilterBranches": [
      {
        "filterBranches": [],
        "filters": [
          {
            "property": "hs_name",
            "operation": {
              "operator": "IS_EQUAL_TO",
              "includeObjectsWithNoValueSet": false,
              "value": "{property_that_changed}",
              "operationType": "STRING"
            },
            "filterType": "PROPERTY"
          },
          {
            "property": "hs_value",
            "operation": {
              "operator": "IS_KNOWN",
              "includeObjectsWithNoValueSet": false,
              "operationType": "ALL_PROPERTY"
            },
            "filterType": "PROPERTY"
          }
        ],
        "eventTypeId": "{event_type_id}",
        "operator": "HAS_COMPLETED",
        "filterBranchType": "UNIFIED_EVENTS",
        "filterBranchOperator": "AND"
      }
    ],
    "refinementCriteria": {
      "filterBranches": [
        {
          "filterBranches": [],
          "filters": [
            {
              "property": "{additional_filter_property}",
              "operation": {
                "operator": "IS_ANY_OF",
                "includeObjectsWithNoValueSet": false,
                "values": ["{value}"],
                "operationType": "ENUMERATION"
              },
              "filterType": "PROPERTY"
            }
          ],
          "filterBranchType": "AND",
          "filterBranchOperator": "AND"
        }
      ],
      "filters": [],
      "filterBranchType": "OR",
      "filterBranchOperator": "OR"
    },
    "listMembershipFilterBranches": [],
    "type": "EVENT_BASED"
  }
}
```

**Known eventTypeIds:**
- `4-655002` = Property change event (deal object)
- `4-1814177` = Playbook completion event

### 1G. LIST_BASED — IS_KNOWN / IS_AFTER Date Filters

Used for "property exists" and "created after date" checks.
Used in: Staff Onboarding.

```json
{
  "filters": [
    {
      "property": "{property_name}",
      "operation": {
        "operator": "IS_KNOWN",
        "includeObjectsWithNoValueSet": false,
        "operationType": "ALL_PROPERTY"
      },
      "filterType": "PROPERTY"
    },
    {
      "property": "createdate",
      "operation": {
        "operator": "IS_AFTER",
        "includeObjectsWithNoValueSet": false,
        "timePoint": {
          "timezoneSource": "CUSTOM",
          "zoneId": "UTC",
          "indexReference": {
            "referenceType": "TODAY"
          },
          "offset": {
            "days": -{days_lookback}
          },
          "timeType": "INDEXED"
        },
        "endpointBehavior": "EXCLUSIVE",
        "propertyParser": "VALUE",
        "operationType": "TIME_POINT",
        "type": "TIME_POINT"
      },
      "filterType": "PROPERTY"
    }
  ]
}
```

---

## 2. RE-ENROLLMENT TRIGGER PATTERNS

### 2A. Property Change Re-enrollment (dealstage change)

Re-enroll when a specific property changes to a specific value. Uses `hs_name` / `hs_value` pattern.

```json
{
  "reEnrollmentTriggersFilterBranches": [
    {
      "filterBranches": [],
      "filters": [
        {
          "property": "hs_name",
          "operation": {
            "operator": "IS_EQUAL_TO",
            "includeObjectsWithNoValueSet": false,
            "value": "{property_that_changed}",
            "operationType": "STRING"
          },
          "filterType": "PROPERTY"
        },
        {
          "property": "hs_value",
          "operation": {
            "operator": "IS_ANY_OF",
            "includeObjectsWithNoValueSet": false,
            "values": ["{new_value}"],
            "operationType": "ENUMERATION"
          },
          "filterType": "PROPERTY"
        }
      ],
      "filterBranchType": "AND",
      "filterBranchOperator": "AND"
    }
  ]
}
```

### 2B. Property Becomes Known Re-enrollment

Re-enroll when any value is set on a property (not caring about the specific value).

```json
{
  "reEnrollmentTriggersFilterBranches": [
    {
      "filterBranches": [],
      "filters": [
        {
          "property": "hs_name",
          "operation": {
            "operator": "IS_EQUAL_TO",
            "includeObjectsWithNoValueSet": false,
            "value": "{property_name}",
            "operationType": "STRING"
          },
          "filterType": "PROPERTY"
        },
        {
          "property": "hs_value",
          "operation": {
            "operator": "IS_KNOWN",
            "includeObjectsWithNoValueSet": false,
            "operationType": "ALL_PROPERTY"
          },
          "filterType": "PROPERTY"
        }
      ],
      "filterBranchType": "AND",
      "filterBranchOperator": "AND"
    }
  ]
}
```

### 2C. Date Property Change Re-enrollment (TIME_RANGED)

Re-enroll when a date property changes and falls within a range.

```json
{
  "reEnrollmentTriggersFilterBranches": [
    {
      "filterBranches": [],
      "filters": [
        {
          "property": "{date_property}",
          "operation": {
            "operator": "IS_BETWEEN",
            "includeObjectsWithNoValueSet": false,
            "lowerBoundEndpointBehavior": "INCLUSIVE",
            "upperBoundEndpointBehavior": "INCLUSIVE",
            "propertyParser": "VALUE",
            "lowerBoundTimePoint": {
              "timezoneSource": "CUSTOM",
              "zoneId": "UTC",
              "indexReference": { "referenceType": "NOW" },
              "timeType": "INDEXED"
            },
            "upperBoundTimePoint": {
              "timezoneSource": "CUSTOM",
              "zoneId": "UTC",
              "indexReference": { "referenceType": "TODAY" },
              "offset": { "days": {days_ahead} },
              "timeType": "INDEXED"
            },
            "operationType": "TIME_RANGED",
            "type": "TIME_RANGED"
          },
          "filterType": "PROPERTY"
        }
      ],
      "filterBranchType": "AND",
      "filterBranchOperator": "AND"
    }
  ]
}
```

---

## 3. ACTION PATTERNS

### 3A. Set Property — Static Value (0-5)

Set a property to a fixed value on the enrolled object.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-5",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "property_name": "{property_name}",
    "value": {
      "staticValue": "{value}",
      "type": "STATIC_VALUE"
    }
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3B. Set Property — On Associated Object (0-5 with association)

Set a property on an associated object (e.g., set lifecyclestage on contacts associated with a deal).

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-5",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "property_name": "{property_name}",
    "association": {
      "associationCategory": "HUBSPOT_DEFINED",
      "associationTypeId": {association_type_id}
    },
    "value": {
      "staticValue": "{value}",
      "type": "STATIC_VALUE"
    }
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3C. Set Property — Copy From Associated Object (OBJECT_PROPERTY)

Copy a property value from the enrolled object to an associated object (or from associated to enrolled).

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-5",
  "fields": {
    "property_name": "{target_property}",
    "association": {
      "associationCategory": "HUBSPOT_DEFINED",
      "associationTypeId": {association_type_id}
    },
    "value": {
      "propertyName": "{source_property}",
      "type": "OBJECT_PROPERTY"
    }
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3D. Set Property — No Association (on enrolled object itself)

Set property directly on enrolled object with empty association.

```json
{
  "fields": {
    "property_name": "{property_name}",
    "association": {},
    "value": {
      "staticValue": "{value}",
      "type": "STATIC_VALUE"
    }
  }
}
```

### 3E. Internal Email Notification (0-8)

Send internal notification to the owner of the enrolled object.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-8",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "subject": "{email_subject_with_tokens}",
    "body": "<p>{html_body_content}</p>",
    "owner_properties": ["{owner_property_name}"]
  },
  "type": "SINGLE_CONNECTION"
}
```

**Token patterns observed in subjects:**
- `{{ enrolled_object.name }}` — name of the enrolled object
- `{{ enrolled_object.{property} }}` — any property on enrolled object
- `{{ fetched_objects.fetched_object_id.name }}` — name from fetched/associated object
- `{{ _0_2.name }}` — company name (object type 0-2)

**Sending to a team instead of an owner:**
```json
{
  "fields": {
    "team_ids": ["{team_id}"],
    "subject": "{subject}",
    "body": "{body}"
  }
}
```

### 3F. Send Enrolled/Automated Email (0-4)

Send a pre-built marketing email to the enrolled contact.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-4",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "content_id": "{email_content_id}"
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3G. Send Email to Specific Recipients (0-23)

Send a specific email to hardcoded recipient addresses.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-23",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "email_content_id": "{content_id}",
    "recipient_emails": ["{email_address}"]
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3H. Create Task (0-3)

Create a task associated with the enrolled object.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-3",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "task_type": "{CALL|TODO|EMAIL}",
    "subject": "{task_subject_with_tokens}",
    "body": "<p>{html_task_body}</p>",
    "associations": [
      {
        "target": {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": {association_type_id}
        },
        "value": {
          "type": "ENROLLED_OBJECT"
        }
      }
    ],
    "use_explicit_associations": "true",
    "owner_assignment": {
      "value": {
        "staticValue": "{owner_id}",
        "type": "STATIC_VALUE"
      },
      "type": "CUSTOM"
    },
    "priority": "{HIGH|MEDIUM|LOW}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Optional fields for tasks with due dates:**
```json
{
  "due_time": "{timestamp_or_relative}",
  "reminder_time": "{timestamp_or_relative}"
}
```

### 3I. Create Record / Create Deal (0-14)

Create a new CRM record (e.g., deal) with properties copied from enrolled object.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-14",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "object_type_id": "{target_object_type}",
    "properties": [
      {
        "targetProperty": "{property_name}",
        "value": {
          "staticValue": "{static_value}",
          "type": "STATIC_VALUE"
        }
      },
      {
        "targetProperty": "{property_name}",
        "value": {
          "staticValue": "{{ _0_2.name }} {suffix_text}",
          "type": "STATIC_VALUE"
        }
      },
      {
        "targetProperty": "closedate",
        "value": {
          "timeDelay": {
            "delta": {days_from_now},
            "timeUnit": "DAYS",
            "daysOfWeek": []
          },
          "type": "RELATIVE_DATETIME"
        }
      },
      {
        "targetProperty": "hubspot_owner_id",
        "value": {
          "propertyName": "hubspot_owner_id",
          "type": "OBJECT_PROPERTY"
        }
      }
    ],
    "associations": [
      {
        "target": {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": {association_type_id}
        },
        "value": {
          "type": "ENROLLED_OBJECT"
        }
      }
    ],
    "use_explicit_associations": "true"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Value types for created record properties:**
- `STATIC_VALUE` — hardcoded string/number
- `OBJECT_PROPERTY` — copy from enrolled object
- `RELATIVE_DATETIME` — date relative to now (uses `timeDelay` with `delta` + `timeUnit`)

### 3J. Simple Delay (0-1)

Wait a fixed amount of time before proceeding.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-1",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "delta": "{minutes_as_string}",
    "time_unit": "MINUTES"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Common values:**
- `"10"` = 10 minutes
- `"7200"` = 5 days (5 * 24 * 60)
- `"64800"` = 45 days (45 * 24 * 60)

### 3K. Date-Based Delay / Wait Until Date (0-35)

Wait until a specific date property value, with optional time-of-day and offset.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-35",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "date": {
      "propertyName": "{date_property_name}",
      "type": "OBJECT_PROPERTY"
    },
    "delta": "{offset_in_days}",
    "time_unit": "DAYS",
    "time_of_day": {
      "hour": {hour_0_23},
      "minute": {minute_0_59}
    }
  },
  "type": "SINGLE_CONNECTION"
}
```

**Delta values:**
- `"0"` = on the exact date
- `"-7200"` (negative minutes) = before the date (e.g., -7200 min = 5 days before)

### 3L. Event Wait / Wait for Property Change (0-29)

Wait for a specific event to occur (e.g., playbook completion, property change).

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-29",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "event_filter_branches": [
      {
        "filterBranches": [],
        "filters": [
          {
            "property": "hs_name",
            "operation": {
              "operator": "IS_EQUAL_TO",
              "includeObjectsWithNoValueSet": false,
              "value": "{property_to_watch}",
              "operationType": "STRING"
            },
            "filterType": "PROPERTY"
          },
          {
            "property": "hs_value",
            "operation": {
              "operator": "IS_KNOWN",
              "includeObjectsWithNoValueSet": false,
              "operationType": "ALL_PROPERTY"
            },
            "filterType": "PROPERTY"
          }
        ],
        "eventTypeId": "{event_type_id}",
        "operator": "HAS_COMPLETED",
        "filterBranchType": "UNIFIED_EVENTS",
        "filterBranchOperator": "AND"
      }
    ],
    "expiration_minutes": "{timeout_minutes}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Playbook completion variant:**
```json
{
  "event_filter_branches": [
    {
      "filters": [
        {
          "property": "hs_playbook_id",
          "operation": {
            "operator": "IS_ANY_OF",
            "includeObjectsWithNoValueSet": false,
            "values": ["{playbook_id}"],
            "operationType": "ENUMERATION"
          },
          "filterType": "PROPERTY"
        }
      ],
      "eventTypeId": "{playbook_event_type_id}",
      "operator": "HAS_COMPLETED",
      "filterBranchType": "UNIFIED_EVENTS",
      "filterBranchOperator": "AND"
    }
  ],
  "expiration_minutes": "{timeout_minutes}"
}
```

---

## 4. BRANCHING PATTERNS

### 4A. LIST_BRANCH — Single Property Check

Branch based on a single enumeration property value. Always uses OR > AND > filters hierarchy.

```json
{
  "actionId": "{id}",
  "listBranches": [
    {
      "filterBranch": {
        "filterBranches": [
          {
            "filterBranches": [],
            "filters": [
              {
                "property": "{property_name}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{value}"],
                  "operationType": "ENUMERATION"
                },
                "filterType": "PROPERTY"
              }
            ],
            "filterBranchType": "AND",
            "filterBranchOperator": "AND"
          }
        ],
        "filters": [],
        "filterBranchType": "OR",
        "filterBranchOperator": "OR"
      },
      "branchName": "{branch_display_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{next_action_for_this_branch}"
      }
    }
  ],
  "defaultBranchName": "{default_branch_name}",
  "defaultBranch": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_for_default}"
  },
  "type": "LIST_BRANCH"
}
```

### 4B. LIST_BRANCH — Multiple Branches

Route to different actions based on different values of the same property.

```json
{
  "actionId": "{id}",
  "listBranches": [
    {
      "filterBranch": {
        "filterBranches": [
          {
            "filterBranches": [],
            "filters": [
              {
                "property": "{property_name}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{value_a}"],
                  "operationType": "ENUMERATION"
                },
                "filterType": "PROPERTY"
              }
            ],
            "filterBranchType": "AND",
            "filterBranchOperator": "AND"
          }
        ],
        "filters": [],
        "filterBranchType": "OR",
        "filterBranchOperator": "OR"
      },
      "branchName": "{branch_a_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_for_a}"
      }
    },
    {
      "filterBranch": {
        "filterBranches": [
          {
            "filterBranches": [],
            "filters": [
              {
                "property": "{property_name}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{value_b}"],
                  "operationType": "ENUMERATION"
                },
                "filterType": "PROPERTY"
              }
            ],
            "filterBranchType": "AND",
            "filterBranchOperator": "AND"
          }
        ],
        "filters": [],
        "filterBranchType": "OR",
        "filterBranchOperator": "OR"
      },
      "branchName": "{branch_b_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_for_b}"
      }
    }
  ],
  "defaultBranchName": "{default_name}",
  "defaultBranch": {
    "edgeType": "STANDARD",
    "nextActionId": "{action_for_default}"
  },
  "type": "LIST_BRANCH"
}
```

### 4C. LIST_BRANCH — Form Submission Check

Branch based on whether a contact filled out a specific form.

```json
{
  "listBranches": [
    {
      "filterBranch": {
        "filterBranches": [
          {
            "filterBranches": [],
            "filters": [
              {
                "formId": "{form_guid}",
                "operator": "FILLED_OUT",
                "filterType": "FORM_SUBMISSION"
              }
            ],
            "filterBranchType": "AND",
            "filterBranchOperator": "AND"
          }
        ],
        "filters": [],
        "filterBranchType": "OR",
        "filterBranchOperator": "OR"
      },
      "branchName": "{filled_out_branch_name}"
    }
  ],
  "defaultBranchName": "{not_filled_out_branch_name}",
  "defaultBranch": {
    "edgeType": "STANDARD",
    "nextActionId": "{action_for_not_filled}"
  },
  "type": "LIST_BRANCH"
}
```

### 4D. STATIC_BRANCH — Based on Prior Action Output

Branch based on whether a prior event/wait action's criteria was met. Uses `inputValue` referencing a prior action.

```json
{
  "actionId": "{id}",
  "inputValue": {
    "actionId": "{prior_event_wait_action_id}",
    "dataKey": "hs_event_criteria_met",
    "type": "FIELD_DATA"
  },
  "staticBranches": [
    {
      "branchValue": "true",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_if_criteria_met}"
      }
    }
  ],
  "defaultBranchName": "{criteria_not_met_label}",
  "defaultBranch": {
    "edgeType": "STANDARD",
    "nextActionId": "{action_if_criteria_not_met}"
  },
  "type": "STATIC_BRANCH"
}
```

### 4E. STATIC_BRANCH — Simple (no inputValue)

Sometimes STATIC_BRANCH is used as a simple pass-through with only a defaultBranch.

```json
{
  "actionId": "{id}",
  "defaultBranch": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "type": "STATIC_BRANCH"
}
```

---

## 5. WORKFLOW SKELETON

Complete minimal workflow structure:

```json
{
  "name": "[VD] {Workflow Name}",
  "objectTypeId": "{object_type}",
  "type": "WORKFLOW",
  "isEnabled": false,
  "startActionId": "{first_action_id}",
  "nextAvailableActionId": "{highest_action_id_plus_1_as_string}",
  "enrollmentCriteria": { ... },
  "actions": [ ... ]
}
```

**Critical rules:**
- `nextAvailableActionId` must be a STRING (e.g., `"5"` not `5`)
- `startActionId` is a STRING pointing to the first action
- All action `actionId` values are STRINGS
- `connection.nextActionId` values are STRINGS
- Terminal actions have no `connection` key (or `nextActionId` is null)
- LIST_BRANCH uses `listBranches` (NOT `filterListBranches`)
- `defaultBranch` must include `nextActionId` — empty `{}` causes HTTP 500
- Wrap all LIST_BRANCH filters in OR > AND > filters hierarchy

---

## 6. ASSOCIATION TYPE ID REFERENCE

| ID  | From     | To       | Description                    |
|-----|----------|----------|--------------------------------|
| 2   | Contact  | Company  | Standard contact-to-company    |
| 3   | Deal     | Contact  | Standard deal-to-contact       |
| 8   | Company  | Task     | Company-to-task                |
| 280 | Contact  | Company  | Primary company association    |
| 341 | Deal     | Company  | Standard deal-to-company       |
| 342 | Company  | Deal     | Standard company-to-deal       |

---

## 7. OPERATOR REFERENCE

| Operator                  | operationType    | Use Case                        |
|---------------------------|------------------|---------------------------------|
| IS_ANY_OF                 | ENUMERATION      | Match any of listed values      |
| IS_EQUAL_TO               | STRING           | Exact string match              |
| IS_KNOWN                  | ALL_PROPERTY     | Property has any value          |
| IS_BETWEEN                | TIME_RANGED      | Date within range               |
| IS_BEFORE                 | TIME_POINT       | Date before a point             |
| IS_AFTER                  | TIME_POINT       | Date after a point              |
| FILLED_OUT                | (FORM_SUBMISSION)| Contact filled out a form       |
| HAS_COMPLETED             | (UNIFIED_EVENTS) | Event occurred                  |

---

## 8. COMMON WORKFLOW PATTERNS

### Pattern: Notify Owner + Set Properties (Closed Won / Deal Lost)
1. LIST_BRANCH on deal type
2. Set multiple properties on associated contacts/companies (0-5 with association)
3. Send internal email to deal owner (0-8)

### Pattern: Date-Triggered Process (MSA Renewal)
1. Enroll with TIME_RANGED on date property (e.g., "within 90 days")
2. Create a new deal (0-14) with properties copied from enrolled object
3. Send notification (0-8)
4. Delay (0-1)
5. Send follow-up notification (0-8)

### Pattern: Property Sync (Deal > Company)
1. EVENT_BASED enrollment on property change
2. Single 0-5 action with OBJECT_PROPERTY value type + association

### Pattern: Onboarding Sequence (Multi-Step with Branches)
1. LIST_BRANCH on team/type property
2. Per branch: Send emails (0-8) to different recipients/teams
3. Event wait (0-29) for playbook completion
4. STATIC_BRANCH on wait result
5. If completed: continue to next step
6. If not completed: send reminder email (0-8)

### Pattern: Contact Lifecycle Management
1. Enroll company when lifecycle = customer + has associated contacts
2. Set properties on enrolled company (0-5 without association)
3. Set properties on associated contacts (0-5 with associationTypeId 280)
4. Copy owner from company to contacts (OBJECT_PROPERTY value type)
