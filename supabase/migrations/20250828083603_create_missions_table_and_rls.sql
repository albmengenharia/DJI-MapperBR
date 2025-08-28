-- Create the missions table
CREATE TABLE public.missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    request_payload JSONB NOT NULL,
    result_payload JSONB
);

-- Enable Row-Level Security
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own missions
CREATE POLICY "Allow individual read access"
ON public.missions
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for users to insert their own missions
CREATE POLICY "Allow individual insert access"
ON public.missions
FOR INSERT
WITH CHECK (auth.uid() = user_id);
