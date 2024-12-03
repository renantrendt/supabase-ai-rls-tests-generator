# Contributing to Supabase AI RLS Tests Generator

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github
We use Github to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html)
Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License
In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issue tracker](https://github.com/renantrendt/supabase-ai-rls-tests-generator/issues)
We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/renantrendt/supabase-ai-rls-tests-generator/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Process

1. Clone the repository:
\`\`\`bash
git clone https://github.com/renantrendt/supabase-ai-rls-tests-generator.git
cd supabase-ai-rls-tests-generator
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Create a .env.rls-test file with your test credentials:
\`\`\`env
SUPABASE_RLS_URL=your_supabase_url
SUPABASE_RLS_KEY=your_supabase_key
SUPABASE_RLS_CLAUDE_KEY=your_claude_key
\`\`\`

4. Run tests:
\`\`\`bash
npm test
\`\`\`

5. Build the project:
\`\`\`bash
npm run build
\`\`\`

## Setup Database Function
Before testing, you need to set up the required database function in your Supabase project:

\`\`\`sql
CREATE OR REPLACE FUNCTION public.get_policies(target_table text)
RETURNS TABLE (
    table_name text,
    policy_name text,
    definition text,
    command text,
    permissive text
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT
        schemaname || '.' || tablename as table_name,
        policyname as policy_name,
        regexp_replace(regexp_replace(coalesce(qual, ''), '\n', ' ', 'g'), '\s+', ' ', 'g') as definition,
        cmd as command,
        permissive
    FROM pg_policies
    WHERE (schemaname || '.' || tablename) = target_table
    OR tablename = target_table;
$$;
\`\`\`

## License
By contributing, you agree that your contributions will be licensed under its MIT License.