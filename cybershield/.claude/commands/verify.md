# /verify — Live end-to-end verification of a page or API route

Verifies that a specific page or API route is working correctly against
the running app, without relying solely on static code review.

## When to use

- After fixing a bug in a page or route: confirm the fix works live
- Before committing: confirm the change doesn't break the page's happy path
- When `npm run build` passes but you suspect a runtime query issue

## Steps

### 1. Confirm services are up

```bash
pg_isready -h localhost -p 5432 || service postgresql start
redis-cli ping || redis-server --daemonize yes
```

### 2. Confirm dev server port

```bash
tail -20 /tmp/dev.log 2>/dev/null | grep -E "Local:|Port [0-9]+ is in use"
```

If the log shows `Port 3000 is in use, trying 3001 instead`, use 3001.
If no dev server is running, start one:

```bash
cd /home/user/cyber-awareness-training/cybershield
nohup npm run dev > /tmp/dev.log 2>&1 &
sleep 8
tail -5 /tmp/dev.log
```

Set PORT to whichever port the server is actually using.

### 3. Acquire a session cookie

Determine which role the route requires (from CLAUDE.md §2 or the route's
`requireRole` call), then log in as the appropriate seeded account:

```bash
PORT=3001  # adjust to actual port

rm -f /tmp/cj.txt
CSRF=$(curl -s -c /tmp/cj.txt http://localhost:$PORT/api/auth/csrf \
  | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# For ADMIN routes:
curl -s -b /tmp/cj.txt -c /tmp/cj.txt -X POST \
  http://localhost:$PORT/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&email=admin@cybershield.local&password=ChangeMe!2026&redirect=false&json=true" \
  -o /dev/null -w "login: %{http_code}\n"

# For MANAGER routes, replace with:
#   email=manager@cybershield.local&password=Manager!2026

# For EMPLOYEE routes, replace with:
#   email=alice.chen@cybershield.local&password=Employee!2026
```

### 4. Exercise the route

For an **API route**, curl it directly and inspect the JSON:

```bash
curl -s -b /tmp/cj.txt http://localhost:$PORT/api/admin/stats | python3 -m json.tool
```

For a **page**, grep the HTML for a key string that proves the data
loaded (a model title, a count, a visible UI label tied to real data —
not a static string that would appear even if the query returned nothing):

```bash
curl -s -b /tmp/cj.txt http://localhost:$PORT/admin \
  | grep -o "Active Courses[^<]*<[^>]*>[^<]*" | head -3
```

For pages with Server-side React (RSC payload), the data is often in a
JSON blob in the HTML — use python3 to search it:

```bash
curl -s -b /tmp/cj.txt http://localhost:$PORT/PAGE -o /tmp/page.html
python3 -c "
import re; html = open('/tmp/page.html').read()
idx = html.find('SEARCH_TERM')
print(html[max(0,idx-200):idx+300])
"
```

### 5. Evaluate the result

**Pass criteria:**

For an API route:
- HTTP 2xx status
- JSON matches the expected shape (not `{"error": ...}`)
- Key numeric fields have non-zero values when data exists in the database
- No `passwordHash` field present in any user object

For a page:
- HTTP 200 status
- HTML contains a model title or real data value (not just a static label)
- The zero-state placeholder ("No courses yet.", "No employees found.")
  does NOT appear when data is expected to exist

**If the result looks wrong:**

1. Check `/tmp/dev.log` for a compilation error on the route.
2. Check if Next.js returned a 404 mid-compile (first hit in dev mode
   triggers lazy compilation — retry once before diagnosing a real 404).
3. Run the Prisma query in isolation:

```bash
cd /home/user/cyber-awareness-training/cybershield
DATABASE_URL="postgresql://cybershield:cybershield@localhost:5432/cybershield" \
  npx tsx -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  // paste the suspect query here
  console.log(JSON.stringify(result, null, 2));
  await db.\$disconnect();
})();
"
```

4. Check that the query uses `OR: [{ tenantId }, { tenantId: null }]` for
   Course/SimulationTemplate, not flat `{ tenantId }` (see CLAUDE.md §3
   Mistake 1).

### 6. Clean up test data

If the verification created any database rows (enrollments, notifications,
grants, nudge logs), delete them:

```bash
cd /home/user/cyber-awareness-training/cybershield
DATABASE_URL="postgresql://cybershield:cybershield@localhost:5432/cybershield" \
  npx tsx -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  await db.enrollment.deleteMany({ where: { ... } });
  await db.\$disconnect();
})();
"
```
