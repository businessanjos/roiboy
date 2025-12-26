-- Add new status value 'triage' to the enum
ALTER TYPE zapp_assignment_status ADD VALUE IF NOT EXISTS 'triage';