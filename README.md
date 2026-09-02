# EventSphere – Milestones 1–4

This ready-to-replace build preserves the Milestone 1/2 event, registration, ticket/QR, attendee, check-in, vendor, assignment, rating and final-report workflow and adds the Milestone 3/4 requirements from the supplied milestone document.

## Added Milestone 3
- REST APIs for events and operational data
- Budget creation/update
- Expense tracking and categories
- Sponsorship tracking
- Remaining budget and utilization calculation
- Notifications
- Reminders
- Approval workflow
- Organizer dashboard

## Added Milestone 4
- Analytics dashboard and KPIs
- Event comparison visualization
- Resource management and utilization
- Basic attendance forecasting
- CSV attendee report
- PDF event report
- Integration/health endpoint
- Docker packaging
- GitHub Actions CI validation

## Run
```bash
npm install
npm start
```
Open `http://localhost:3000`.

## Important
Keep your existing `database.sqlite` if you want to preserve existing Milestone 1/2 records. The server creates new Milestone 3/4 tables automatically using `CREATE TABLE IF NOT EXISTS`.

## Main files to replace
- `server.js`
- `public/index.html`
- `public/script.js`
- `public/style.css`
- `package.json`

Optional finalization files included:
- `Dockerfile`
- `.dockerignore`
- `.github/workflows/ci.yml`
- `README.md`
