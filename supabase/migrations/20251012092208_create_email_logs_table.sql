/*
  # Email Logs Table for n8n Automation Dashboard

  1. New Tables
    - `email_logs`
      - `id` (serial, primary key) - Auto-incrementing unique identifier
      - `recipient` (varchar 255) - Email recipient address
      - `email_type` (varchar 100) - Type/category of email sent
      - `subject` (text) - Email subject line
      - `body` (text) - Email body content
      - `variables` (jsonb) - Dynamic variables used in the email
      - `target_date` (date) - Target/scheduled date for the email
      - `status` (varchar 50) - Status of the email (sent, failed, pending, etc.)
      - `note` (text) - Additional notes or error messages
      - `timestamp` (timestamptz) - When the log entry was created

  2. Indexes
    - Index on `timestamp` for efficient sorting and filtering
    - Index on `target_date` for date-based queries

  3. Security
    - Enable RLS on `email_logs` table
    - Add policy for authenticated users to read all logs
    - Add policy for service role to insert logs (for n8n webhook)

  4. Notes
    - Uses JSONB for efficient JSON storage and querying
    - Timestamp defaults to current time for automatic logging
    - Indexes optimize common query patterns (latest logs, date filtering)
*/

CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    email_type VARCHAR(100),
    subject TEXT,
    body TEXT,
    variables JSONB,
    target_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    note TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_timestamp ON email_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_target_date ON email_logs (target_date);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert email logs"
  ON email_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Anon users can read all email logs"
  ON email_logs
  FOR SELECT
  TO anon
  USING (true);