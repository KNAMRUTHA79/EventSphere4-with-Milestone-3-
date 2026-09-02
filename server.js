const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
    date TEXT, venue TEXT, capacity INTEGER, status TEXT DEFAULT 'Upcoming',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT, registration_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT NOT NULL,
    college TEXT, department TEXT, event_id INTEGER, ticket_id TEXT UNIQUE NOT NULL,
    qr_code TEXT, status TEXT DEFAULT 'Registered', checked_in_at DATETIME,
    FOREIGN KEY(event_id) REFERENCES events(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT UNIQUE NOT NULL,
    event_id INTEGER, attendee_id INTEGER, qr_code TEXT,
    issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id), FOREIGN KEY(attendee_id) REFERENCES attendees(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, service_type TEXT NOT NULL, contact_number TEXT,
    email TEXT, availability TEXT, rating REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS vendor_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, vendor_id TEXT,
    service TEXT, status TEXT DEFAULT 'Assigned', assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id), FOREIGN KEY(vendor_id) REFERENCES vendors(vendor_id))`);

  db.run(`CREATE TABLE IF NOT EXISTS event_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, rating REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(event_id) REFERENCES events(id))`);

  // Milestone 3
  db.run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER UNIQUE, amount REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, category TEXT NOT NULL,
    description TEXT, amount REAL NOT NULL, approval_status TEXT DEFAULT 'Approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(event_id) REFERENCES events(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, name TEXT NOT NULL,
    amount REAL NOT NULL, contact TEXT, status TEXT DEFAULT 'Confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(event_id) REFERENCES events(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, recipient TEXT,
    type TEXT NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT 'Sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(event_id) REFERENCES events(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, item_type TEXT NOT NULL,
    item_id INTEGER, amount REAL, reason TEXT, status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, decided_at DATETIME,
    FOREIGN KEY(event_id) REFERENCES events(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, reminder_date TEXT,
    message TEXT, status TEXT DEFAULT 'Pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id))`);

  // Milestone 4
  db.run(`CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1, available INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS resource_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER, event_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1, status TEXT DEFAULT 'Allocated',
    allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id), FOREIGN KEY(event_id) REFERENCES events(id))`);

  db.run(`INSERT OR IGNORE INTO events (id,name,description,date,venue,capacity,status) VALUES
    (1,'AI Workshop 2026','Learn Artificial Intelligence fundamentals','2026-09-15','Jeppiaar University Hall A',200,'Upcoming'),
    (2,'Python Bootcamp','Master Python programming','2026-09-20','Jeppiaar University Lab 2',150,'Upcoming'),
    (3,'Data Science Conference','Big Data and Analytics','2026-09-25','Convention Center',300,'Upcoming')`);
});

function run(sql, params = []) { return new Promise((resolve, reject) => db.run(sql, params, function(err){ if(err) reject(err); else resolve(this); })); }
function get(sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (err,row)=>err?reject(err):resolve(row))); }
function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (err,rows)=>err?reject(err):resolve(rows))); }
function validRating(n){ return Number.isFinite(Number(n)) && Number(n)>=1 && Number(n)<=5; }
function notification(eventId, recipient, type, message){ return run(`INSERT INTO notifications(event_id,recipient,type,message) VALUES(?,?,?,?,?)`, [eventId,recipient,type,message]).catch(()=>{}); }
function csvEscape(value){ const s = value == null ? '' : String(value); return `"${s.replace(/"/g,'""')}"`; }

// ==================== MILESTONE 1/2: EVENTS ====================
app.get('/api/events', async (req,res)=>{
  try { res.json(await all('SELECT * FROM events ORDER BY date ASC')); } catch(e){ res.status(500).json({error:e.message}); }
});
app.get('/api/events/:id', async (req,res)=>{
  try { const row=await get('SELECT * FROM events WHERE id=?',[req.params.id]); if(!row)return res.status(404).json({error:'Event not found'}); res.json(row); }
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/events', async (req,res)=>{
  const {name,description,date,venue,capacity}=req.body;
  if(!name)return res.status(400).json({error:'Event name is required'});
  try { const r=await run('INSERT INTO events(name,description,date,venue,capacity) VALUES(?,?,?,?,?)',[name,description||'',date||'',venue||'',Number(capacity)||0]); res.status(201).json({success:true,message:'Event created successfully!',event:{id:r.lastID,name}}); }
  catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/events/:id', async (req,res)=>{
  const {name,description,date,venue,capacity,status}=req.body;
  try { const r=await run('UPDATE events SET name=COALESCE(?,name),description=COALESCE(?,description),date=COALESCE(?,date),venue=COALESCE(?,venue),capacity=COALESCE(?,capacity),status=COALESCE(?,status) WHERE id=?',[name,description,date,venue,capacity,status,req.params.id]); if(!r.changes)return res.status(404).json({error:'Event not found'}); res.json({success:true,message:'Event updated successfully'}); }
  catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/events/:id', async (req,res)=>{
  try { const r=await run('DELETE FROM events WHERE id=?',[req.params.id]); if(!r.changes)return res.status(404).json({error:'Event not found'}); res.json({success:true,message:'Event deleted successfully'}); }
  catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/events/:id/complete', async (req,res)=>{
  try { const r=await run("UPDATE events SET status='Completed' WHERE id=?",[req.params.id]); if(!r.changes)return res.status(404).json({error:'Event not found'}); await notification(req.params.id,'Organizer','Event Completion','Event has been marked as completed.'); res.json({success:true,message:'Event marked as completed'}); }
  catch(e){res.status(500).json({error:e.message});}
});

// ==================== REGISTRATION / TICKETS / CHECK-IN ====================
app.post('/api/register', async (req,res)=>{
  const {name,email,phone,college,department,event_id}=req.body;
  if(!name||!email||!phone||!event_id)return res.status(400).json({error:'Name, Email, Phone, and Event ID are required'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Invalid email format'});
  if(!/^[0-9]{10}$/.test(phone))return res.status(400).json({error:'Phone number must be 10 digits'});
  try {
    const event=await get('SELECT * FROM events WHERE id=?',[event_id]); if(!event)return res.status(404).json({error:'Event not found'});
    const existing=await get('SELECT * FROM attendees WHERE email=? AND event_id=?',[email,event_id]); if(existing)return res.status(409).json({error:'This email is already registered for this event'});
    const count=await get('SELECT COUNT(*) AS c FROM attendees WHERE event_id=?',[event_id]);
    if(event.capacity && count.c>=event.capacity)return res.status(409).json({error:'Event capacity is full'});
    const ticketId='TKT'+Date.now()+Math.floor(Math.random()*1000); const registrationId='REG'+Date.now().toString().slice(-6);
    const qrCodeUrl=await QRCode.toDataURL(JSON.stringify({ticket:ticketId,name,event:event.name,reg:registrationId}));
    const a=await run(`INSERT INTO attendees(registration_id,name,email,phone,college,department,event_id,ticket_id,qr_code,status) VALUES(?,?,?,?,?,?,?,?,?,'Registered')`,[registrationId,name,email,phone,college||'',department||'',event_id,ticketId,qrCodeUrl]);
    await run('INSERT INTO tickets(ticket_id,event_id,attendee_id,qr_code) VALUES(?,?,?,?)',[ticketId,event_id,a.lastID,qrCodeUrl]);
    await notification(event_id,email,'Registration','Registration successful. Ticket '+ticketId+' has been generated.');
    res.status(201).json({success:true,message:'Registration successful!',ticket:{ticketId,registrationId,name,eventName:event.name,qrCode:qrCodeUrl}});
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/attendees/:eventId', async (req,res)=>{try{res.json(await all('SELECT * FROM attendees WHERE event_id=? ORDER BY id DESC',[req.params.eventId]));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/checkin', async (req,res)=>{
  const {ticket_id}=req.body; if(!ticket_id)return res.status(400).json({error:'Ticket ID is required'});
  try { const a=await get('SELECT * FROM attendees WHERE ticket_id=?',[ticket_id]); if(!a)return res.status(404).json({error:'Invalid ticket ID'}); if(a.status==='Checked In')return res.status(400).json({error:'Already checked in'});
    await run("UPDATE attendees SET status='Checked In',checked_in_at=CURRENT_TIMESTAMP WHERE ticket_id=?",[ticket_id]); await notification(a.event_id,a.email,'Check-In','Check-in successful for ticket '+ticket_id+'.');
    res.json({success:true,message:'Check-in successful!',attendee:{name:a.name,ticket:a.ticket_id,event:a.event_id}});
  } catch(e){res.status(500).json({error:e.message});}
});

// ==================== VENDORS ====================
app.get('/api/vendors', async (req,res)=>{try{res.json(await all('SELECT * FROM vendors ORDER BY name'));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/vendors', async (req,res)=>{const {name,service_type,contact_number,email,availability}=req.body;if(!name||!service_type)return res.status(400).json({error:'Name and Service Type are required'});try{const vendorId='VEND'+Date.now().toString().slice(-6);await run('INSERT INTO vendors(vendor_id,name,service_type,contact_number,email,availability) VALUES(?,?,?,?,?,?)',[vendorId,name,service_type,contact_number||'',email||'',availability||'']);res.status(201).json({success:true,message:'Vendor added successfully!',vendor:{id:vendorId,name,service_type}});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/assign-vendor', async (req,res)=>{const {event_id,vendor_id,service}=req.body;if(!event_id||!vendor_id)return res.status(400).json({error:'Event ID and Vendor ID are required'});try{const v=await get('SELECT * FROM vendors WHERE vendor_id=?',[vendor_id]);if(!v)return res.status(404).json({error:'Vendor not found'});await run('INSERT INTO vendor_assignments(event_id,vendor_id,service) VALUES(?,?,?)',[event_id,vendor_id,service||'General Service']);await notification(event_id,v.email,'Vendor Assignment','You have been assigned to an EventSphere event.');res.json({success:true,message:'Vendor assigned to event successfully!'});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/event-vendors/:eventId',async(req,res)=>{try{res.json(await all(`SELECT v.*,va.service,va.status,va.assigned_at FROM vendor_assignments va JOIN vendors v ON va.vendor_id=v.vendor_id WHERE va.event_id=?`,[req.params.eventId]));}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/vendor-assignments',async(req,res)=>{try{res.json(await all(`SELECT va.*,e.name event_name,v.name vendor_name,v.service_type FROM vendor_assignments va JOIN events e ON va.event_id=e.id JOIN vendors v ON va.vendor_id=v.vendor_id ORDER BY va.assigned_at DESC`));}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/vendors/:vendorId/rate',async(req,res)=>{const {rating}=req.body;if(!validRating(rating))return res.status(400).json({error:'Rating must be between 1 and 5'});try{const r=await run('UPDATE vendors SET rating=? WHERE vendor_id=?',[rating,req.params.vendorId]);if(!r.changes)return res.status(404).json({error:'Vendor not found'});res.json({success:true,message:'Vendor rated successfully!'});}catch(e){res.status(500).json({error:e.message});}});

// ==================== MILESTONE 2 RATINGS / REPORT ====================
app.post('/api/rate-event',async(req,res)=>{const {event_id,event_rating,vendor_ratings=[]}=req.body;if(!event_id||!validRating(event_rating))return res.status(400).json({error:'Event ID and valid Event Rating required'});try{await run('INSERT INTO event_ratings(event_id,rating) VALUES(?,?)',[event_id,event_rating]);for(const r of vendor_ratings){if(validRating(r.rating))await run('UPDATE vendors SET rating=? WHERE vendor_id=?',[r.rating,r.vendor_id]);}res.json({success:true,message:'Ratings saved successfully!'});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/report/:eventId',async(req,res)=>{try{const stats=await get(`SELECT COUNT(*) total_registered,SUM(CASE WHEN status='Checked In' THEN 1 ELSE 0 END) checked_in FROM attendees WHERE event_id=?`,[req.params.eventId]);const vendors=await all(`SELECT v.name,v.rating FROM vendor_assignments va JOIN vendors v ON va.vendor_id=v.vendor_id WHERE va.event_id=?`,[req.params.eventId]);const er=await get('SELECT AVG(rating) avg_event_rating FROM event_ratings WHERE event_id=?',[req.params.eventId]);const ev=Number(er?.avg_event_rating||0);const av=vendors.length?vendors.reduce((s,v)=>s+Number(v.rating||0),0)/vendors.length:0;res.json({event_id:req.params.eventId,total_registered:stats.total_registered||0,checked_in:stats.checked_in||0,vendors,avg_event_rating:ev.toFixed(2),avg_vendor_rating:av.toFixed(2),success_score:((ev+av)/2).toFixed(2)});}catch(e){res.status(500).json({error:e.message});}});

// ==================== MILESTONE 3: BUDGET ====================
app.get('/api/budget/:eventId',async(req,res)=>{try{const budget=await get('SELECT * FROM budgets WHERE event_id=?',[req.params.eventId]);const ex=await get(`SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE event_id=? AND approval_status='Approved'`,[req.params.eventId]);const sp=await get(`SELECT COALESCE(SUM(amount),0) total FROM sponsors WHERE event_id=? AND status='Confirmed'`,[req.params.eventId]);const total=Number(budget?.amount||0),expenses=Number(ex.total||0),sponsors=Number(sp.total||0);res.json({event_id:Number(req.params.eventId),budget:total,total_expenses:expenses,total_sponsorship:sponsors,remaining_budget:total-expenses,budget_utilization:total?Number((expenses/total*100).toFixed(2)):0,net_balance:total+ sponsors-expenses});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/budget',async(req,res)=>{const {event_id,amount}=req.body;if(!event_id||Number(amount)<0)return res.status(400).json({error:'Event ID and valid budget amount are required'});try{await run(`INSERT INTO budgets(event_id,amount) VALUES(?,?) ON CONFLICT(event_id) DO UPDATE SET amount=excluded.amount,updated_at=CURRENT_TIMESTAMP`,[event_id,Number(amount)]);res.json({success:true,message:'Budget saved successfully'});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/expenses/:eventId',async(req,res)=>{try{res.json(await all('SELECT * FROM expenses WHERE event_id=? ORDER BY created_at DESC',[req.params.eventId]));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/expenses',async(req,res)=>{const {event_id,category,description,amount,approval_status='Approved'}=req.body;if(!event_id||!category||Number(amount)<=0)return res.status(400).json({error:'Event, category and positive amount are required'});try{const r=await run('INSERT INTO expenses(event_id,category,description,amount,approval_status) VALUES(?,?,?,?,?)',[event_id,category,description||'',Number(amount),approval_status]);if(approval_status==='Pending')await run('INSERT INTO approvals(event_id,item_type,item_id,amount,reason) VALUES(?,?,?,?,?)',[event_id,'Expense',r.lastID,Number(amount),description||category]);res.status(201).json({success:true,message:'Expense added successfully',expense_id:r.lastID});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/sponsors/:eventId',async(req,res)=>{try{res.json(await all('SELECT * FROM sponsors WHERE event_id=? ORDER BY created_at DESC',[req.params.eventId]));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/sponsors',async(req,res)=>{const {event_id,name,amount,contact,status='Confirmed'}=req.body;if(!event_id||!name||Number(amount)<=0)return res.status(400).json({error:'Event, sponsor name and positive amount are required'});try{const r=await run('INSERT INTO sponsors(event_id,name,amount,contact,status) VALUES(?,?,?,?,?)',[event_id,name,Number(amount),contact||'',status]);await notification(event_id,contact||name,'Sponsorship','Sponsorship record added for '+name+'.');res.status(201).json({success:true,message:'Sponsorship saved',sponsor_id:r.lastID});}catch(e){res.status(500).json({error:e.message});}});

// ==================== MILESTONE 3: AUTOMATION ====================
app.get('/api/notifications',async(req,res)=>{try{res.json(await all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/notifications',async(req,res)=>{const {event_id,recipient,type,message}=req.body;if(!type||!message)return res.status(400).json({error:'Type and message are required'});try{await notification(event_id||null,recipient||'Organizer',type,message);res.status(201).json({success:true,message:'Notification created'});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/approvals',async(req,res)=>{try{res.json(await all('SELECT a.*,e.name event_name FROM approvals a LEFT JOIN events e ON a.event_id=e.id ORDER BY a.created_at DESC'));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/approvals',async(req,res)=>{const {event_id,item_type,item_id,amount,reason}=req.body;if(!event_id||!item_type)return res.status(400).json({error:'Event and item type are required'});try{const r=await run('INSERT INTO approvals(event_id,item_type,item_id,amount,reason) VALUES(?,?,?,?,?)',[event_id,item_type,item_id||null,amount||0,reason||'']);res.status(201).json({success:true,approval_id:r.lastID,status:'Pending'});}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/approvals/:id',async(req,res)=>{const {status}=req.body;if(!['Approved','Rejected'].includes(status))return res.status(400).json({error:'Status must be Approved or Rejected'});try{const a=await get('SELECT * FROM approvals WHERE id=?',[req.params.id]);if(!a)return res.status(404).json({error:'Approval not found'});await run('UPDATE approvals SET status=?,decided_at=CURRENT_TIMESTAMP WHERE id=?',[status,req.params.id]);if(a.item_type==='Expense'&&a.item_id)await run('UPDATE expenses SET approval_status=? WHERE id=?',[status,a.item_id]);await notification(a.event_id,'Organizer','Approval '+status,status+' approval for '+a.item_type+' #'+a.item_id);res.json({success:true,message:'Approval updated'});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/reminders',async(req,res)=>{try{res.json(await all('SELECT r.*,e.name event_name FROM reminders r LEFT JOIN events e ON r.event_id=e.id ORDER BY reminder_date ASC'));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/reminders',async(req,res)=>{const {event_id,reminder_date,message}=req.body;if(!event_id||!reminder_date)return res.status(400).json({error:'Event and reminder date are required'});try{const r=await run('INSERT INTO reminders(event_id,reminder_date,message) VALUES(?,?,?)',[event_id,reminder_date,message||'Event reminder']);res.status(201).json({success:true,reminder_id:r.lastID,message:'Reminder scheduled'});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/automation/run',async(req,res)=>{try{const upcoming=await all(`SELECT * FROM events WHERE date>=date('now') AND date<=date('now','+1 day') AND status!='Completed'`);for(const e of upcoming){await notification(e.id,'Registered Attendees','Reminder','Reminder: '+e.name+' is scheduled on '+e.date+'.');await run("UPDATE reminders SET status='Sent' WHERE event_id=? AND reminder_date<=date('now') AND status='Pending'",[e.id]);}res.json({success:true,processed_events:upcoming.length,message:'Automation cycle completed'});}catch(e){res.status(500).json({error:e.message});}});

// ==================== MILESTONE 4: ANALYTICS / OPTIMIZATION ====================
app.get('/api/dashboard',async(req,res)=>{try{const [events,regs,checked,vendors,resources,budget]=await Promise.all([get('SELECT COUNT(*) c FROM events'),get('SELECT COUNT(*) c FROM attendees'),get("SELECT COUNT(*) c FROM attendees WHERE status='Checked In'"),get('SELECT COUNT(*) c FROM vendors'),get('SELECT COALESCE(SUM(quantity),0) total,COALESCE(SUM(available),0) available FROM resources'),get('SELECT COALESCE(SUM(amount),0) amount FROM budgets')]);const expenses=await get("SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE approval_status='Approved'");res.json({events:events.c||0,registrations:regs.c||0,checked_in:checked.c||0,attendance_rate:regs.c?Number((checked.c/regs.c*100).toFixed(2)):0,vendors:vendors.c||0,resources_total:resources.total||0,resources_available:resources.available||0,total_budget:budget.amount||0,total_expenses:expenses.amount||0,remaining_budget:Number(budget.amount||0)-Number(expenses.amount||0)});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/analytics/:eventId',async(req,res)=>{try{const e=await get('SELECT * FROM events WHERE id=?',[req.params.eventId]);if(!e)return res.status(404).json({error:'Event not found'});const s=await get(`SELECT COUNT(*) registered,SUM(CASE WHEN status='Checked In' THEN 1 ELSE 0 END) checked_in FROM attendees WHERE event_id=?`,[req.params.eventId]);const b=await get('SELECT amount FROM budgets WHERE event_id=?',[req.params.eventId]);const ex=await get("SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE event_id=? AND approval_status='Approved'",[req.params.eventId]);const sp=await get("SELECT COALESCE(SUM(amount),0) amount FROM sponsors WHERE event_id=? AND status='Confirmed'",[req.params.eventId]);res.json({event:e,registrations:s.registered||0,checked_in:s.checked_in||0,attendance_rate:s.registered?Number((s.checked_in/s.registered*100).toFixed(2)):0,budget:Number(b?.amount||0),expenses:Number(ex.amount||0),sponsorship:Number(sp.amount||0),remaining_budget:Number(b?.amount||0)-Number(ex.amount||0)});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/event-comparison',async(req,res)=>{try{res.json(await all(`SELECT e.id,e.name,e.date,e.capacity,COUNT(a.id) registrations,COALESCE(SUM(CASE WHEN a.status='Checked In' THEN 1 ELSE 0 END),0) checked_in,ROUND(CASE WHEN COUNT(a.id)>0 THEN SUM(CASE WHEN a.status='Checked In' THEN 1 ELSE 0 END)*100.0/COUNT(a.id) ELSE 0 END,2) attendance_rate FROM events e LEFT JOIN attendees a ON a.event_id=e.id GROUP BY e.id ORDER BY e.date`));}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/resources',async(req,res)=>{try{res.json(await all('SELECT * FROM resources ORDER BY name'));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/resources',async(req,res)=>{const {name,category,quantity}=req.body;if(!name||!category||Number(quantity)<=0)return res.status(400).json({error:'Name, category and positive quantity are required'});try{const r=await run('INSERT INTO resources(name,category,quantity,available) VALUES(?,?,?,?)',[name,category,Number(quantity),Number(quantity)]);res.status(201).json({success:true,resource_id:r.lastID,message:'Resource added'});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/resource-allocations',async(req,res)=>{const {resource_id,event_id,quantity}=req.body;if(!resource_id||!event_id||Number(quantity)<=0)return res.status(400).json({error:'Resource, event and positive quantity are required'});try{const r=await get('SELECT * FROM resources WHERE id=?',[resource_id]);if(!r)return res.status(404).json({error:'Resource not found'});if(r.available<Number(quantity))return res.status(409).json({error:'Not enough resource available'});await run('INSERT INTO resource_allocations(resource_id,event_id,quantity) VALUES(?,?,?)',[resource_id,event_id,Number(quantity)]);await run('UPDATE resources SET available=available-? WHERE id=?',[Number(quantity),resource_id]);res.json({success:true,message:'Resource allocated successfully'});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/resource-utilization',async(req,res)=>{try{res.json(await all(`SELECT r.id,r.name,r.category,r.quantity, r.available, ROUND((r.quantity-r.available)*100.0/NULLIF(r.quantity,0),2) utilization FROM resources r ORDER BY utilization DESC`));}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/forecast',async(req,res)=>{try{const rows=await all(`SELECT e.id,e.name,e.date,COUNT(a.id) attendees FROM events e LEFT JOIN attendees a ON a.event_id=e.id GROUP BY e.id ORDER BY e.date`);const valid=rows.filter(r=>Number(r.attendees)>0);const avg=valid.length?valid.reduce((s,r)=>s+Number(r.attendees),0)/valid.length:0;res.json({historical_events:rows,average_attendance:Number(avg.toFixed(2)),forecast_for_next_event:Math.round(avg),recommendation:avg?`Prepare capacity and resources for about ${Math.round(avg)} attendees.`:'Add historical registrations to generate a forecast.'});}catch(e){res.status(500).json({error:e.message});}});

// ==================== REPORTING: CSV / PDF ====================
app.get('/api/reports/attendees.csv',async(req,res)=>{try{const rows=await all(`SELECT a.ticket_id,a.name,a.email,a.phone,a.college,a.department,e.name event_name,a.status,a.checked_in_at FROM attendees a LEFT JOIN events e ON a.event_id=e.id ORDER BY a.id`);const header=['Ticket ID','Name','Email','Phone','College','Department','Event','Status','Checked In At'];const csv=[header,...rows.map(r=>header.map(h=>csvEscape(r[h.toLowerCase().replaceAll(' ','_')])) )].map(r=>r.join(',')).join('\n');res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="eventsphere_attendees.csv"');res.send(csv);}catch(e){res.status(500).json({error:e.message});}});

function makeSimplePdf(title, lines){
  const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const content=['BT','/F1 18 Tf','50 760 Td',`(${esc(title)}) Tj`,'/F1 10 Tf','0 -28 Td',...lines.flatMap(l=>[`(${esc(l)}) Tj`,'0 -16 Td']),'ET'].join('\n');
  const objects=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,`<< /Length ${Buffer.byteLength(content,'utf8')} >>\nstream\n${content}\nendstream`];
  let pdf='%PDF-1.4\n', offsets=[0]; for(let i=0;i<objects.length;i++){offsets[i+1]=Buffer.byteLength(pdf,'utf8');pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,'utf8');pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'utf8');
}
app.get('/api/reports/event/:eventId.pdf',async(req,res)=>{try{const a=await get(`SELECT e.name,e.date,e.venue,COUNT(at.id) registrations,SUM(CASE WHEN at.status='Checked In' THEN 1 ELSE 0 END) checked_in FROM events e LEFT JOIN attendees at ON at.event_id=e.id WHERE e.id=? GROUP BY e.id`,[req.params.eventId]);if(!a)return res.status(404).send('Event not found');const b=await get('SELECT amount FROM budgets WHERE event_id=?',[req.params.eventId]);const ex=await get("SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE event_id=? AND approval_status='Approved'",[req.params.eventId]);const sp=await get("SELECT COALESCE(SUM(amount),0) amount FROM sponsors WHERE event_id=? AND status='Confirmed'",[req.params.eventId]);const lines=[`Event: ${a.name}`,`Date: ${a.date||'TBD'}`,`Venue: ${a.venue||'TBD'}`,`Registrations: ${a.registrations||0}`,`Checked In: ${a.checked_in||0}`,`Attendance Rate: ${a.registrations?((a.checked_in/a.registrations)*100).toFixed(2):0}%`,`Budget: ₹${Number(b?.amount||0).toFixed(2)}`,`Expenses: ₹${Number(ex.amount||0).toFixed(2)}`,`Sponsorship: ₹${Number(sp.amount||0).toFixed(2)}`,`Remaining Budget: ₹${(Number(b?.amount||0)-Number(ex.amount||0)).toFixed(2)}`];res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="eventsphere_event_${req.params.eventId}.pdf"`);res.send(makeSimplePdf('EventSphere Event Report',lines));}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/stats/:eventId',async(req,res)=>{try{const event=await get('SELECT name,capacity FROM events WHERE id=?',[req.params.eventId]);if(!event)return res.status(404).json({error:'Event not found'});const s=await get(`SELECT COUNT(*) total_registered,SUM(CASE WHEN status='Checked In' THEN 1 ELSE 0 END) checked_in,SUM(CASE WHEN status='Registered' THEN 1 ELSE 0 END) pending FROM attendees WHERE event_id=?`,[req.params.eventId]);res.json({event:event.name,capacity:event.capacity,total_registered:s.total_registered||0,checked_in:s.checked_in||0,pending:s.pending||0,attendance_rate:s.total_registered?Math.round(s.checked_in/s.total_registered*100):0,available_spots:Math.max(0,(event.capacity||0)-(s.total_registered||0))});}catch(e){res.status(500).json({error:e.message});}});

app.get('/health',(req,res)=>res.json({status:'ok',service:'EventSphere',milestones:['1','2','3','4']}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,()=>console.log(`🚀 EventSphere server running on http://localhost:${PORT}`));

