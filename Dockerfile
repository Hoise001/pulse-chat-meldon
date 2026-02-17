FROM oven/bun:1.3.5

COPY apps/server/build/out/pulse-linux-x64 /pulse

ENV RUNNING_IN_DOCKER=true

# Required environment variables:
# DATABASE_URL - PostgreSQL connection string (e.g., postgresql://postgres:password@db:5432/postgres)
# SUPABASE_URL - Supabase API URL (e.g., http://kong:8000)
# SUPABASE_ANON_KEY - Supabase anonymous key
# SUPABASE_SERVICE_ROLE_KEY - Supabase service role key

RUN chmod +x /pulse

CMD ["/pulse"]