# HubSpot v4 Workflow Pattern Catalog — v2

Extracted from 30+ production workflows. All real values replaced with placeholders.

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
- `2` = Contact -> Company (standard)
- `3` = Deal -> Contact (standard)
- `5` = Deal -> Company (standard)
- `6` = Company -> Deal (standard)
- `8` = Company -> Task (for task associations)
- `17` = Custom Object -> Company (USER_DEFINED)
- `199` = Contact -> Communication Subscription (HUBSPOT_DEFINED)
- `204` = Contact -> Task (HUBSPOT_DEFINED)
- `192` = Company -> Task (HUBSPOT_DEFINED)
- `279` = Contact -> Company (primary, HUBSPOT_DEFINED)
- `280` = Company -> Contact (primary, HUBSPOT_DEFINED)
- `341` = Deal -> Company (standard)
- `342` = Company -> Deal (reverse)

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
- `4-655002` = Property change event (company/custom object)
- `4-665538` = Email bounce/reply event (contact)
- `4-666439` = Email hard bounce event (contact)
- `4-1463224` = Property change event (custom object variant)
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

### 1H. NEW: EVENT_BASED — Generic Object Created Trigger (No Filters)

Enroll on ANY property change event with no specific filter — triggers on any object creation/update.
Used in: Custom Object auto-association when any record is created.

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "eventFilterBranches": [
      {
        "filterBranches": [],
        "filters": [],
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
              "property": "{required_property_1}",
              "operation": {
                "operator": "IS_KNOWN",
                "includeObjectsWithNoValueSet": false,
                "operationType": "ALL_PROPERTY"
              },
              "filterType": "PROPERTY"
            },
            {
              "property": "{required_property_2}",
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

**Key difference:** `filters` array inside `eventFilterBranches[0]` is EMPTY. This triggers on any event of that type. The refinementCriteria then gates enrollment to only records where required properties are known.

### 1I. NEW: EVENT_BASED — Property Cleared Trigger (IS_UNKNOWN)

Enroll when a property is CLEARED (set to unknown/empty). Used for data quality detection.

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
              "value": "{property_that_was_cleared}",
              "operationType": "STRING"
            },
            "filterType": "PROPERTY"
          },
          {
            "property": "hs_value",
            "operation": {
              "operator": "IS_UNKNOWN",
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
              "property": "{other_property}",
              "operation": {
                "operator": "IS_UNKNOWN",
                "includeObjectsWithNoValueSet": false,
                "operationType": "ALL_PROPERTY"
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

**Key difference from 1F:** Uses `IS_UNKNOWN` on `hs_value` instead of `IS_KNOWN`. This fires when a property is cleared/deleted, not when it is set.

### 1J. NEW: EVENT_BASED — List Membership Trigger (listMembershipFilterBranches)

Enroll when a contact is added to a specific list. Uses `listMembershipFilterBranches` instead of property-based enrollment.
Used in: Re-engagement controllers where a separate list defines eligible contacts.

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "eventFilterBranches": [],
    "listMembershipFilterBranches": [
      {
        "filterBranches": [],
        "filters": [
          {
            "listId": "{list_id}",
            "operator": "IN_LIST",
            "filterType": "IN_LIST"
          }
        ],
        "filterBranchType": "AND",
        "filterBranchOperator": "AND"
      }
    ],
    "type": "EVENT_BASED"
  }
}
```

**Key insight:** This is EVENT_BASED (not LIST_BASED) but uses `listMembershipFilterBranches` instead of `eventFilterBranches`. The `eventFilterBranches` array is empty. This enrolls contacts the moment they join the list.

### 1K. NEW: LIST_BASED — MULTISTRING CONTAINS / CONTAINS_EXACTLY / DOES_NOT_CONTAIN

Used for text-based pattern matching on string properties like email addresses or message content.
Used in: Spam detection, bounce filtering.

```json
{
  "enrollmentCriteria": {
    "listFilterBranch": {
      "filterBranches": [
        {
          "filterBranches": [],
          "filters": [
            {
              "property": "{string_property}",
              "operation": {
                "operator": "CONTAINS",
                "includeObjectsWithNoValueSet": false,
                "values": ["{keyword_1}", "{keyword_2}", "{keyword_3}"],
                "operationType": "MULTISTRING"
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
              "property": "{text_property}",
              "operation": {
                "operator": "CONTAINS_EXACTLY",
                "includeObjectsWithNoValueSet": false,
                "values": ["{exact_term_1}", "{exact_term_2}"],
                "operationType": "MULTISTRING"
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
              "property": "{string_property}",
              "operation": {
                "operator": "CONTAINS_EXACTLY",
                "includeObjectsWithNoValueSet": false,
                "values": ["{domain_suffix_1}", "{domain_suffix_2}"],
                "operationType": "MULTISTRING"
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
    "type": "LIST_BASED"
  }
}
```

**Operators for MULTISTRING:**
- `CONTAINS` — property value contains any of the listed substrings (case-insensitive)
- `CONTAINS_EXACTLY` — property value contains an exact match of any listed term
- `DOES_NOT_CONTAIN` — property value does NOT contain any of the listed substrings

### 1L. NEW: LIST_BASED — NUMBER Comparison (IS_GREATER_THAN)

Enroll when a numeric property exceeds a threshold.
Used in: Company owner governance when associated count exceeds limit.

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "listFilterBranch": {
      "filterBranches": [
        {
          "filterBranches": [],
          "filters": [
            {
              "property": "{number_property}",
              "operation": {
                "operator": "IS_GREATER_THAN",
                "includeObjectsWithNoValueSet": false,
                "value": {threshold_number},
                "operationType": "NUMBER"
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
    "type": "LIST_BASED"
  }
}
```

### 1M. NEW: LIST_BASED — UPDATED_AT Date Parser (Property Last Modified)

Enroll when a property was MODIFIED within a time window. Uses `propertyParser: "UPDATED_AT"` instead of `"VALUE"`.
Used in: Notification workflows that detect recently changed owner/manager assignments.

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "listFilterBranch": {
      "filterBranches": [
        {
          "filterBranches": [],
          "filters": [
            {
              "property": "{property_name}",
              "operation": {
                "operator": "IS_BETWEEN",
                "includeObjectsWithNoValueSet": false,
                "lowerBoundEndpointBehavior": "INCLUSIVE",
                "upperBoundEndpointBehavior": "INCLUSIVE",
                "propertyParser": "UPDATED_AT",
                "lowerBoundTimePoint": {
                  "timezoneSource": "CUSTOM",
                  "zoneId": "{timezone_iana}",
                  "indexReference": {
                    "referenceType": "TODAY"
                  },
                  "offset": {
                    "days": -{lookback_days}
                  },
                  "timeType": "INDEXED"
                },
                "upperBoundTimePoint": {
                  "timezoneSource": "CUSTOM",
                  "zoneId": "{timezone_iana}",
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
          ],
          "filterBranchType": "AND",
          "filterBranchOperator": "AND"
        }
      ],
      "filters": [],
      "filterBranchType": "OR",
      "filterBranchOperator": "OR"
    },
    "type": "LIST_BASED"
  }
}
```

**Key difference from 1D:** `propertyParser` is `"UPDATED_AT"` instead of `"VALUE"`. This checks WHEN the property was last MODIFIED, not the property's date value itself.

### 1N. NEW: EVENT_BASED — Refinement with ASSOCIATION Sub-Branch + DOES_NOT_CONTAIN

Complex refinement combining direct property checks, exclusion patterns, and association checks.
Used in: Bounce/employment handlers that filter out personal emails and check associated company priority.

```json
{
  "refinementCriteria": {
    "filterBranches": [
      {
        "filterBranches": [
          {
            "filterBranches": [],
            "filters": [
              {
                "property": "{associated_object_property}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{tier_1}", "{tier_2}", "{tier_3}"],
                  "operationType": "ENUMERATION"
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
            "property": "{string_property}",
            "operation": {
              "operator": "DOES_NOT_CONTAIN",
              "includeObjectsWithNoValueSet": false,
              "values": ["{excluded_domain_1}", "{excluded_domain_2}"],
              "operationType": "MULTISTRING"
            },
            "filterType": "PROPERTY"
          },
          {
            "property": "{enum_property}",
            "operation": {
              "operator": "IS_NONE_OF",
              "includeObjectsWithNoValueSet": false,
              "values": ["{excluded_type_1}", "{excluded_type_2}"],
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

### 1O. NEW: LIST_BASED — Custom Object with USER_DEFINED Association Check

Enroll a custom object when it has NO associated company (association IS_UNKNOWN via ASSOCIATION branch).
Used in: Orphaned custom object detection and auto-association.

```json
{
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "listFilterBranch": {
      "filterBranches": [
        {
          "filterBranches": [
            {
              "filterBranches": [],
              "filters": [
                {
                  "property": "name",
                  "operation": {
                    "operator": "IS_UNKNOWN",
                    "includeObjectsWithNoValueSet": false,
                    "operationType": "ALL_PROPERTY"
                  },
                  "filterType": "PROPERTY"
                }
              ],
              "objectTypeId": "0-2",
              "operator": "IN_LIST",
              "associationTypeId": {user_defined_association_type_id},
              "associationCategory": "USER_DEFINED",
              "filterBranchType": "ASSOCIATION",
              "filterBranchOperator": "AND"
            }
          ],
          "filters": [
            {
              "property": "{required_property}",
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
      ],
      "filters": [],
      "filterBranchType": "OR",
      "filterBranchOperator": "OR"
    },
    "type": "LIST_BASED"
  }
}
```

**Key insight:** For custom objects, association checks use `associationCategory: "USER_DEFINED"` instead of `"HUBSPOT_DEFINED"`. The `associationTypeId` is a USER_DEFINED type ID.

### 1P. NEW: LIST_BASED — Company Enrollment via Associated Contact Spam Status

Enroll a company when it is ITSELF marked as spam OR when its associated contacts are marked as spam.
Used in: Company spam cascading deletion.

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
              "property": "lifecyclestage",
              "operation": {
                "operator": "IS_ANY_OF",
                "includeObjectsWithNoValueSet": false,
                "values": ["{spam_lifecycle_stage_id}"],
                "operationType": "ENUMERATION"
              },
              "filterType": "PROPERTY"
            }
          ],
          "filterBranchType": "AND",
          "filterBranchOperator": "AND"
        },
        {
          "filterBranches": [
            {
              "filterBranches": [],
              "filters": [
                {
                  "property": "lifecyclestage",
                  "operation": {
                    "operator": "IS_ANY_OF",
                    "includeObjectsWithNoValueSet": false,
                    "values": ["{spam_lifecycle_stage_id}"],
                    "operationType": "ENUMERATION"
                  },
                  "filterType": "PROPERTY"
                }
              ],
              "objectTypeId": "0-1",
              "operator": "IN_LIST",
              "associationTypeId": 280,
              "associationCategory": "HUBSPOT_DEFINED",
              "filterBranchType": "ASSOCIATION",
              "filterBranchOperator": "AND"
            }
          ],
          "filters": [],
          "filterBranchType": "AND",
          "filterBranchOperator": "AND"
        }
      ],
      "filters": [],
      "filterBranchType": "OR",
      "filterBranchOperator": "OR"
    },
    "type": "LIST_BASED"
  }
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

### 2D. NEW: Property Becomes Unknown Re-enrollment (Cleared)

Re-enroll when a property is CLEARED. Uses `IS_UNKNOWN` on `hs_value`.
Used in: Custom object governance - when owner/manager is removed.

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
            "operator": "IS_UNKNOWN",
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

### 2E. NEW: Number Threshold Re-enrollment

Re-enroll when a numeric property changes and exceeds a threshold. Uses NUMBER operationType.

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
            "value": "{number_property_name}",
            "operationType": "STRING"
          },
          "filterType": "PROPERTY"
        },
        {
          "property": "hs_value",
          "operation": {
            "operator": "IS_GREATER_THAN",
            "includeObjectsWithNoValueSet": false,
            "value": {threshold},
            "operationType": "NUMBER"
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

**NEW: Sending to specific user IDs instead of owners:**
```json
{
  "fields": {
    "user_ids": ["{user_id}"],
    "subject": "{subject}",
    "body": "{body}"
  }
}
```

**NEW: Sending to MULTIPLE owner properties (custom object with multiple owner fields):**
```json
{
  "fields": {
    "subject": "{subject}",
    "body": "<p>{html_body}</p>",
    "owner_properties": ["{owner_property_1}", "{owner_property_2}"]
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

**NEW: Task with COPY_ASSOCIATION (associate task with enrolled contact's company):**

```json
{
  "fields": {
    "task_type": "TODO",
    "subject": "{task_subject}",
    "body": "{html_body}",
    "associations": [
      {
        "target": {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 204
        },
        "value": {
          "type": "ENROLLED_OBJECT"
        }
      },
      {
        "target": {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 192
        },
        "value": {
          "sourceSpec": {
            "associationCategory": "HUBSPOT_DEFINED",
            "associationTypeId": 279
          },
          "type": "COPY_ASSOCIATION"
        }
      }
    ],
    "use_explicit_associations": "false",
    "owner_assignment": {
      "value": {
        "propertyName": "hubspot_owner_id",
        "type": "OBJECT_PROPERTY"
      },
      "type": "CUSTOM"
    },
    "priority": "HIGH",
    "due_time": {
      "delta": {days_delta},
      "timeUnit": "DAYS",
      "timeOfDay": {
        "hour": {hour_0_23},
        "minute": {minute_0_59}
      },
      "daysOfWeek": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    }
  }
}
```

**Key insight:** `COPY_ASSOCIATION` copies an association from the enrolled object to the task. In this example, the task is associated with:
1. The enrolled contact directly (204 = Contact -> Task)
2. The contact's primary company (192 = Company -> Task), copied via `sourceSpec` from the contact's company association (279 = Contact -> Company primary)

**Association IDs for tasks:**
- `204` = Contact -> Task (HUBSPOT_DEFINED)
- `192` = Company -> Task (HUBSPOT_DEFINED)

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
    "delta": "{amount_as_string}",
    "time_unit": "{MINUTES|DAYS}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Common values:**
- `"5"` MINUTES = 5 minutes
- `"10"` MINUTES = 10 minutes
- `"1"` DAYS = 1 day
- `"20"` DAYS = 20 days
- `"2880"` MINUTES = 2 days
- `"7200"` MINUTES = 5 days
- `"43200"` MINUTES = 30 days
- `"64800"` MINUTES = 45 days

**NEW: time_unit can be "DAYS" (not just "MINUTES").**

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

### 3M. NEW: Delete Object (0-18224765)

Permanently delete the enrolled CRM record.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 42,
  "actionTypeId": "0-18224765",
  "fields": {},
  "type": "SINGLE_CONNECTION"
}
```

**Critical notes:**
- `actionTypeVersion` is `42` (not 0 like most actions)
- `fields` is empty `{}`
- This is a TERMINAL action (no `connection` key)
- Always add a safety check BEFORE this action (LIST_BRANCH to verify lifecycle stage)

### 3N. NEW: Add to Static List (0-63809083)

Add the enrolled object to a specific static list (or remove with different fields).

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 3,
  "actionTypeId": "0-63809083",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "listId": "{list_id}",
    "targetObject": "{{ enrolled_object }}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Delete variant (remove from all lists and delete):**
```json
{
  "actionId": "{id}",
  "actionTypeVersion": 3,
  "actionTypeId": "0-63809083",
  "fields": {
    "targetObject": "{{ enrolled_object }}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Note:** `actionTypeVersion` is `3` (not 0). When `listId` is omitted, the action removes the object.

### 3O. NEW: Auto-Associate Records by Property Match (0-63189541)

Automatically create an association between two object types by matching property values.
Used in: Custom Object -> Company association based on domain or name matching.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 6,
  "actionTypeId": "0-63189541",
  "fields": {
    "fromObjectType": "{custom_object_type_id}",
    "toObjectType": "0-2",
    "createAssociationOnly": "{true|false}",
    "matchBy": "fromAndToObjects",
    "enrolledObjectPropertyNameToMatch": "{custom_object_type_id}/{source_property}",
    "associatedObjectPropertyNameToMatch": "0-2/{target_property}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Key details:**
- `actionTypeVersion` is `6`
- Property names are qualified with object type: `"{objectTypeId}/{propertyName}"`
- `matchBy: "fromAndToObjects"` matches enrolled object property against target object property
- `createAssociationOnly: "true"` = only associate, don't create new records
- `createAssociationOnly: "false"` = create a new record if no match found

### 3P. NEW: Set Property from Fetched Object (FETCHED_OBJECT_PROPERTY)

Copy a property value from a fetched/associated object using the `propertyToken` syntax.
Used in: Custom Object -> Company owner propagation.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-5",
  "fields": {
    "property_name": "{target_property}",
    "value": {
      "propertyToken": "{{ fetched_objects.{fetched_object_name}.{source_property} }}",
      "type": "FETCHED_OBJECT_PROPERTY"
    }
  },
  "type": "SINGLE_CONNECTION"
}
```

**Key difference from OBJECT_PROPERTY:** Uses `propertyToken` with template syntax instead of `propertyName`. This references a fetched object from `dataSources`, not the enrolled object directly.

### 3Q. NEW: Set Property to Execution Timestamp (TIMESTAMP)

Set a date property to the current execution time.
Used in: Tracking enrollment dates for re-engagement flows.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-5",
  "fields": {
    "property_name": "{date_property_name}",
    "value": {
      "timestampType": "EXECUTION_TIME",
      "type": "TIMESTAMP"
    }
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3R. NEW: Enroll in Sequence (0-46510720)

Enroll the contact in a sales sequence with sender configuration.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 6,
  "actionTypeId": "0-46510720",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "sequenceId": "{sequence_id}",
    "shouldUseContactTimeZone": "{true|false}",
    "senderType": "CONTACT_OWNER",
    "contactOwnerProperty": "hubspot_owner_id"
  },
  "type": "SINGLE_CONNECTION"
}
```

**Key details:**
- `actionTypeVersion` is `6`
- `senderType: "CONTACT_OWNER"` sends from the contact's owner
- `contactOwnerProperty` specifies which property holds the owner

### 3S. NEW: Copy Owner from Associated Object (0-25)

Copy the owner from an associated object to the enrolled object.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-25",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "source_property": "hubspot_owner_id",
    "target_property": "hubspot_owner_id",
    "target_object": "CONTACT"
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3T. NEW: Set Marketing Contact Status (0-31)

Set a contact's marketing status (marketable or non-marketable).

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 13,
  "actionTypeId": "0-31",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "targetContact": "{{ enrolled_object }}",
    "marketableType": "{MARKETABLE|NON_MARKETABLE}"
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3U. NEW: Manage Communication Subscription (0-43347357)

Opt a contact in or out of a specific communication subscription.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 7,
  "actionTypeId": "0-43347357",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "{next_action_id}"
  },
  "fields": {
    "targetContact": "{{ enrolled_object }}",
    "channel": "EMAIL",
    "optState": "{OPT_IN|OPT_OUT}",
    "subscriptionId": "{subscription_id}",
    "legalBasis": "CONSENT_WITH_NOTICE",
    "legalBasisExplanation": "{explanation_text_with_tokens}"
  },
  "type": "SINGLE_CONNECTION"
}
```

### 3V. NEW: Rotate to Owner (0-11) — List-Based Assignment

Assign contact owner from a list of users without overwriting existing owners.

```json
{
  "actionId": "{id}",
  "actionTypeVersion": 0,
  "actionTypeId": "0-11",
  "fields": {
    "user_ids": ["{user_id}"],
    "target_property": "hubspot_owner_id",
    "overwrite_current_owner": "{true|false}"
  },
  "type": "SINGLE_CONNECTION"
}
```

**WARNING:** Action type `0-11` can cause silent 500 errors on some portals. Prefer `0-5` with static owner ID when possible.

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
*(Same structure as 4A but with multiple entries in `listBranches` array.)*

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

Branch based on whether a prior event/wait action's criteria was met.

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

### 4F. NEW: LIST_BRANCH — IS_UNKNOWN Property Check

Branch on whether a property is empty/unknown. Used for "missing data" routing.
Used in: Data quality checks, orphan detection.

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
                  "operator": "IS_UNKNOWN",
                  "includeObjectsWithNoValueSet": false,
                  "operationType": "ALL_PROPERTY"
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
      "branchName": "{missing_data_branch_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_for_missing}"
      }
    }
  ],
  "type": "LIST_BRANCH"
}
```

### 4G. NEW: LIST_BRANCH — IN_LIST Check

Branch based on whether the contact is a member of a specific list.

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
                "listId": "{list_id}",
                "operator": "IN_LIST",
                "filterType": "IN_LIST"
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
      "branchName": "{in_list_branch_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_for_in_list}"
      }
    }
  ],
  "type": "LIST_BRANCH"
}
```

### 4H. NEW: LIST_BRANCH — BOOL Check

Branch based on a boolean property value.

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
                "property": "{boolean_property}",
                "operation": {
                  "operator": "IS_EQUAL_TO",
                  "includeObjectsWithNoValueSet": false,
                  "value": true,
                  "operationType": "BOOL"
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
      "branchName": "{true_branch_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_for_true}"
      }
    }
  ],
  "type": "LIST_BRANCH"
}
```

### 4I. NEW: LIST_BRANCH — ASSOCIATION Check (Custom Object -> Company)

Branch based on whether the enrolled custom object has an associated company.

```json
{
  "listBranches": [
    {
      "filterBranch": {
        "filterBranches": [
          {
            "filterBranches": [
              {
                "filterBranches": [],
                "filters": [
                  {
                    "property": "name",
                    "operation": {
                      "operator": "IS_KNOWN",
                      "includeObjectsWithNoValueSet": false,
                      "operationType": "ALL_PROPERTY"
                    },
                    "filterType": "PROPERTY"
                  }
                ],
                "objectTypeId": "0-2",
                "operator": "IN_LIST",
                "associationTypeId": {user_defined_association_type_id},
                "associationCategory": "USER_DEFINED",
                "filterBranchType": "ASSOCIATION",
                "filterBranchOperator": "AND"
              }
            ],
            "filters": [
              {
                "property": "{property_name}",
                "operation": {
                  "operator": "IS_EQUAL_TO",
                  "includeObjectsWithNoValueSet": false,
                  "values": [""],
                  "operationType": "MULTISTRING"
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
      "branchName": "{no_association_branch_name}",
      "connection": {
        "edgeType": "STANDARD",
        "nextActionId": "{action_for_no_association}"
      }
    }
  ],
  "type": "LIST_BRANCH"
}
```

### 4J. NEW: LIST_BRANCH with IS_EXACTLY operator

Used for ENUMERATION properties with specific string matching (different from IS_ANY_OF).

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
                "property": "{property_name}",
                "operation": {
                  "operator": "IS_EXACTLY",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{exact_value}"],
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
      "branchName": "{branch_name}"
    }
  ],
  "type": "LIST_BRANCH"
}
```

### 4K. NEW: LIST_BRANCH with GOTO edgeType (Default Branch)

Default branch can use `edgeType: "GOTO"` to jump to a specific action (instead of `"STANDARD"`).

```json
{
  "defaultBranchName": "{default_name}",
  "defaultBranch": {
    "edgeType": "GOTO",
    "nextActionId": "{action_to_jump_to}"
  },
  "type": "LIST_BRANCH"
}
```

**Key insight:** `edgeType: "GOTO"` allows the default branch to skip ahead to any action in the workflow, creating a non-linear flow.

### 4L. NEW: LIST_BRANCH — Multi-Condition Suppression (OR within AND)

Branch with multiple suppression conditions in a single AND group. If ANY condition is true, the branch matches.
Used in: Re-engagement controllers checking optout, bounce, contact type, lifecycle stage, sequence enrollment simultaneously.

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
                "property": "{boolean_property}",
                "operation": {
                  "operator": "IS_EQUAL_TO",
                  "includeObjectsWithNoValueSet": false,
                  "value": true,
                  "operationType": "BOOL"
                },
                "filterType": "PROPERTY"
              },
              {
                "property": "{enum_property}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{bounce_reason_1}", "{bounce_reason_2}"],
                  "operationType": "ENUMERATION"
                },
                "filterType": "PROPERTY"
              },
              {
                "property": "{status_property}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{excluded_status}"],
                  "operationType": "ENUMERATION"
                },
                "filterType": "PROPERTY"
              },
              {
                "property": "{lifecycle_property}",
                "operation": {
                  "operator": "IS_ANY_OF",
                  "includeObjectsWithNoValueSet": false,
                  "values": ["{excluded_stage}"],
                  "operationType": "ENUMERATION"
                },
                "filterType": "PROPERTY"
              },
              {
                "property": "{sequence_enrolled_property}",
                "operation": {
                  "operator": "IS_EQUAL_TO",
                  "includeObjectsWithNoValueSet": false,
                  "value": true,
                  "operationType": "BOOL"
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
      "branchName": "Not eligible"
    }
  ],
  "type": "LIST_BRANCH"
}
```

**IMPORTANT NOTE:** Despite `filterBranchType: "AND"` and `filterBranchOperator: "AND"`, the multiple filters within a single AND group act as OR when used as suppression conditions in a branch. If ANY single filter matches, the contact takes this branch. This is because the branch checks "does the contact match ANY of these disqualifying conditions."

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
  "enrollmentCriteria": { "..." },
  "actions": [ "..." ]
}
```

**Critical rules:**
- `nextAvailableActionId` must be a STRING (e.g., `"5"` not `5`)
- `startActionId` is a STRING pointing to the first action
- All action `actionId` values are STRINGS
- `connection.nextActionId` values are STRINGS
- Terminal actions have no `connection` key (or `nextActionId` is null)
- LIST_BRANCH uses `listBranches` (NOT `filterListBranches`)
- `defaultBranch` must include `nextActionId` -- empty `{}` causes HTTP 500
- Wrap all LIST_BRANCH filters in OR > AND > filters hierarchy

---

## 6. DATASOURCES PATTERNS

### 6A. Standard Association DataSource

Fetch associated objects sorted by last modified date.

```json
{
  "dataSources": [
    {
      "name": "{fetched_object_name}",
      "objectTypeId": "{associated_object_type}",
      "associationTypeId": {association_type_id},
      "associationCategory": "{HUBSPOT_DEFINED|USER_DEFINED}",
      "sortBy": {
        "property": "hs_lastmodifieddate",
        "missing": null,
        "order": "{ASC|DESC}"
      },
      "type": "ASSOCIATION"
    }
  ]
}
```

### 6B. NEW: ASSOCIATION_TIMESTAMP DataSource

Fetch associated object with timestamp-based sorting (most recently associated).
Used in: Custom Object -> Company association fetching.

```json
{
  "dataSources": [
    {
      "name": "{fetched_object_name}",
      "objectTypeId": "{associated_object_type}",
      "associationTypeId": {association_type_id},
      "associationCategory": "{HUBSPOT_DEFINED|USER_DEFINED}",
      "type": "ASSOCIATION_TIMESTAMP"
    }
  ]
}
```

**Key difference from ASSOCIATION:** No `sortBy` field. Uses `type: "ASSOCIATION_TIMESTAMP"` instead of `type: "ASSOCIATION"`. This fetches based on when the association was created.

### 6C. Common DataSource ObjectTypeIds

| objectTypeId | Object Type |
|---|---|
| `0-1` | Contact |
| `0-2` | Company |
| `0-3` | Deal |
| `0-47` | Communication Subscription |
| `{custom_object_type_id}` | Custom Object |

---

## 7. ASSOCIATION TYPE ID REFERENCE

| ID  | From     | To       | Category | Description |
|-----|----------|----------|----------|-------------|
| 2   | Contact  | Company  | HUBSPOT_DEFINED | Standard contact-to-company |
| 3   | Deal     | Contact  | HUBSPOT_DEFINED | Standard deal-to-contact |
| 4   | Contact  | Deal     | HUBSPOT_DEFINED | Standard contact-to-deal |
| 5   | Deal     | Company  | HUBSPOT_DEFINED | Standard deal-to-company |
| 6   | Company  | Deal     | HUBSPOT_DEFINED | Standard company-to-deal |
| 8   | Company  | Task     | HUBSPOT_DEFINED | Company-to-task |
| 17  | Custom Object | Company | USER_DEFINED | Custom object-to-company |
| 192 | Company  | Task     | HUBSPOT_DEFINED | Company-to-task (for task creation) |
| 199 | Contact  | Communication | HUBSPOT_DEFINED | Contact-to-communication-subscription |
| 204 | Contact  | Task     | HUBSPOT_DEFINED | Contact-to-task (for task creation) |
| 279 | Contact  | Company  | HUBSPOT_DEFINED | Primary company association |
| 280 | Company  | Contact  | HUBSPOT_DEFINED | Primary contact association (reverse) |
| 341 | Deal     | Company  | HUBSPOT_DEFINED | Standard deal-to-company |
| 342 | Company  | Deal     | HUBSPOT_DEFINED | Standard company-to-deal (reverse) |

---

## 8. OPERATOR REFERENCE

| Operator                  | operationType    | Use Case                        |
|---------------------------|------------------|---------------------------------|
| IS_ANY_OF                 | ENUMERATION      | Match any of listed values      |
| IS_NONE_OF                | ENUMERATION      | Exclude any of listed values    |
| IS_EXACTLY                | ENUMERATION      | Exact match of value            |
| IS_EQUAL_TO               | STRING           | Exact string match              |
| IS_EQUAL_TO               | BOOL             | Boolean match (true/false)      |
| IS_KNOWN                  | ALL_PROPERTY     | Property has any value          |
| IS_UNKNOWN                | ALL_PROPERTY     | Property has NO value           |
| IS_BETWEEN                | TIME_RANGED      | Date within range               |
| IS_BEFORE                 | TIME_POINT       | Date before a point             |
| IS_AFTER                  | TIME_POINT       | Date after a point              |
| IS_GREATER_THAN           | NUMBER           | Numeric comparison              |
| CONTAINS                  | MULTISTRING      | String contains substring       |
| CONTAINS_EXACTLY          | MULTISTRING      | String contains exact term      |
| DOES_NOT_CONTAIN          | MULTISTRING      | String does NOT contain         |
| FILLED_OUT                | (FORM_SUBMISSION)| Contact filled out a form       |
| HAS_COMPLETED             | (UNIFIED_EVENTS) | Event occurred                  |
| IN_LIST                   | (IN_LIST)        | Contact is in a list            |

---

## 9. COMMON WORKFLOW PATTERNS

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

### NEW Pattern: Spam Detection + Delayed Deletion
1. Enroll via MULTISTRING CONTAINS/CONTAINS_EXACTLY on email/message properties
2. Add contact to spam review list (0-63809083)
3. Set lifecyclestage to spam value (0-5)
4. Send internal notification to admin (0-8 with user_ids)
5. Delay 30 days (0-1 with delta "43200")
6. LIST_BRANCH — check if still in spam list
7. If still in list: Delete object (0-18224765)
8. If removed from list: workflow ends (user rescued the contact)

### NEW Pattern: Lifecycle-Based Immediate Deletion
1. Enroll when lifecyclestage = spam
2. Delay 5 minutes (safety buffer)
3. LIST_BRANCH — re-check lifecyclestage is still spam
4. If spam: Delete object (0-18224765)
5. If not spam: workflow ends (lifecycle was changed during buffer)

### NEW Pattern: Company Cascade Spam Deletion
1. Enroll company when EITHER:
   a. Company lifecyclestage = spam, OR
   b. Associated contacts have lifecyclestage = spam
2. Delay 5 minutes
3. LIST_BRANCH re-check company is still spam
4. If still spam: Remove from lists (0-63809083) then delete (implicit)

### NEW Pattern: Custom Object -> Company Auto-Association (Domain Match)
1. EVENT_BASED enrollment on any creation event (empty filters in eventFilterBranches)
2. Refinement: required properties must be IS_KNOWN
3. Single auto-associate action (0-63189541) matching domain properties
4. objectTypeId on workflow = custom object type

### NEW Pattern: Custom Object -> Company Auto-Association (Name Match)
1. LIST_BASED enrollment when custom object has NO associated company (IS_UNKNOWN in ASSOCIATION sub-branch) AND required property IS_KNOWN
2. LIST_BRANCH — check if custom object already has association
3. If no association: Auto-associate (0-63189541) matching client name to company name
4. createAssociationOnly: "false" allows creating a new company record

### NEW Pattern: Custom Object Owner Propagation from Company
1. LIST_BASED enrollment when owner IS_UNKNOWN
2. Re-enrollment when owner becomes unknown (IS_UNKNOWN on hs_value)
3. Set owner from fetched company (FETCHED_OBJECT_PROPERTY from ASSOCIATION_TIMESTAMP dataSource)
4. DataSource uses USER_DEFINED associationCategory for custom object -> company

### NEW Pattern: Custom Object Data Quality Flags
1. EVENT_BASED enrollment when a specific property is CLEARED (IS_UNKNOWN on hs_value)
2. Refinement: check if another required property is also unknown
3. LIST_BRANCH — which property is missing
4. Set data_quality_issue property to descriptive string value per branch

### NEW Pattern: Bounce/Employment Handler with Association Filter
1. EVENT_BASED enrollment on email bounce or reply event
2. Refinement with ASSOCIATION sub-branch (associated company must have priority tier)
3. Refinement with DOES_NOT_CONTAIN (exclude personal email domains)
4. Refinement with IS_NONE_OF (exclude certain contact types)
5. Set contact_type to "Past Contact"
6. Set lifecyclestage to "other"
7. LIST_BRANCH — check if marketing contact
8. If marketing: Set hs_marketable_status to false
9. Create task with COPY_ASSOCIATION (associate task with contact AND contact's company)
10. Task uses business-day due dates with specific timeOfDay

### NEW Pattern: Re-Engagement Controller with Sequence Enrollment
1. EVENT_BASED enrollment via listMembershipFilterBranches (list join trigger)
2. LIST_BRANCH — suppress ineligible contacts (optout, bounced, wrong type, wrong stage, in sequence)
3. If suppressed: Set re_engagement_status = "Suppressed"
4. If eligible: Check if owner is missing
5. If no owner: Copy owner from company (0-25)
6. Set re_engagement_status = "Enrolled"
7. Set re_engagement_last_enrolled_date = EXECUTION_TIME (TIMESTAMP)
8. Delay 1 day
9. Enroll in sequence (0-46510720) from contact owner
10. Delay 20 days
11. LIST_BRANCH — check if lifecycle progressed to opportunity/customer
12. If progressed: Set re_engagement_status = "Engaged"

### NEW Pattern: Multi-Email Nurture with Subscription Management
1. Enroll when properties are known (createdate + event attendance)
2. Set communication subscription opt-in (0-43347357)
3. Set marketing contact status (0-31)
4. Delay -> Send email -> Delay -> Send email -> Delay -> Send email
5. Each email uses 0-4 with specific content_id

### NEW Pattern: Owner Governance by Association Count
1. LIST_BASED enrollment when number property > threshold
2. Re-enrollment when number property changes and exceeds threshold (NUMBER operationType)
3. Set owner to specific static value
4. Used for companies with multiple associated custom objects

### NEW Pattern: Property Update Notification
1. LIST_BASED enrollment with UPDATED_AT propertyParser
2. Check if property was modified within last day (lowerBound = TODAY-1, upperBound = NOW)
3. Multiple OR branches for different properties being modified
4. Send internal email to owner_properties array (multiple owner fields)
5. Email body uses fetched_objects tokens for associated data

---

## 10. CUSTOM OBJECT WORKFLOW REFERENCE

### Custom Object Workflow Types

Custom objects use `type: "PLATFORM_FLOW"` (not `"CONTACT_FLOW"`).

```json
{
  "objectTypeId": "{custom_object_type_id}",
  "type": "PLATFORM_FLOW"
}
```

### Custom Object DataSources

For custom objects, associations to standard objects (like Company) use `USER_DEFINED` category:

```json
{
  "dataSources": [
    {
      "name": "{fetched_object_name}",
      "objectTypeId": "0-2",
      "associationTypeId": {user_defined_association_type_id},
      "associationCategory": "USER_DEFINED",
      "type": "ASSOCIATION_TIMESTAMP"
    }
  ]
}
```

### Custom Object Property References in Actions

When referencing custom object properties in auto-associate actions, use the qualified format:
```
"{custom_object_type_id}/{property_name}"
```

Example: `"2-210006989/domain"` becomes `"{custom_object_type_id}/domain"`

### Custom Object Event Type IDs

Custom objects have their own event type IDs for property changes:
- Standard objects: `4-655002`
- Custom objects may use different IDs: `4-1463224` (varies by portal and custom object)
