-- Add new status value to client_status enum
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'no_contract';