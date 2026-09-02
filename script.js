/* =========================================================
   EventSphere - Complete Frontend Script
   Milestones 1-4
   Replace: public/script.js
   ========================================================= */

const API = '/api';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function money(value) {
    const number = Number(value || 0);
    return '₹' + number.toLocaleString('en-IN', {
        maximumFractionDigits: 2
    });
}

async function api(url, options = {}) {
    const response = await fetch(API + url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

function msg(id, text, error = false) {
    const element = $(id);

    if (!element) return;

    element.className =
        'result-box' +
        (error ? ' error' : '');

    element.textContent = text || '';

    element.classList.remove('hidden');
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value ?? '';
    }
}

function setValue(id, value) {
    const element = $(id);

    if (element) {
        element.value = value ?? '';
    }
}

function getNumber(id) {
    return Number($(id)?.value || 0);
}

function getValue(id) {
    return ($(id)?.value || '').trim();
}


/* =========================================================
   EVENTS / DASHBOARD
   ========================================================= */

function fillEvents(events) {

    const selectIds = [
        'regEventId',
        'attendeeEventFilter',
        'assignEventId',
        'financeEvent',
        'reminderEvent',
        'analyticsEvent',
        'resourceEvent'
    ];

    selectIds.forEach((id) => {

        const select = $(id);

        if (!select) return;

        const previousValue = select.value;

        select.innerHTML =
            '<option value="">Select Event</option>' +

            events.map((event) => `
                <option value="${escapeHtml(event.id)}">
                    ${escapeHtml(event.name)}
                </option>
            `).join('');

        if (
            events.some(
                (event) =>
                    String(event.id) ===
                    String(previousValue)
            )
        ) {
            select.value = previousValue;
        }

    });
}


async function loadEvents() {

    try {

        const events =
            await api('/events');

        fillEvents(events);

        setText(
            'totalEvents',
            events.length
        );

        const container =
            $('eventsContainer');

        if (container) {

            container.innerHTML =
                events.length

                    ? events.map((event) => `
                        <div class="event-card">

                            <h3>
                                ${escapeHtml(event.name)}
                            </h3>

                            <p>
                                📅
                                ${escapeHtml(
                                    event.date || 'TBD'
                                )}
                            </p>

                            <p>
                                📍
                                ${escapeHtml(
                                    event.venue || 'TBD'
                                )}
                            </p>

                            <p>
                                👥 Capacity:
                                ${
                                    event.capacity
                                        ? escapeHtml(
                                            event.capacity
                                        )
                                        : 'Unlimited'
                                }
                            </p>

                            <span class="badge">
                                ${escapeHtml(
                                    event.status ||
                                    'Upcoming'
                                )}
                            </span>

                        </div>
                    `).join('')

                    : '<p>No events available.</p>';
        }

        return events;

    } catch (error) {

        console.error(
            'Error loading events:',
            error
        );

        msg(
            'dashboardMessage',
            error.message,
            true
        );

        return [];
    }
}


async function loadDashboard() {

    try {

        const data =
            await api('/dashboard');

        setText(
            'totalRegistrations',
            data.registrations || 0
        );

        setText(
            'totalCheckedIn',
            data.checked_in || 0
        );

        setText(
            'totalVendors',
            data.vendors || 0
        );

        setText(
            'dashBudget',
            money(data.total_budget)
        );

        setText(
            'dashExpenses',
            money(data.total_expenses)
        );

    } catch (error) {

        console.error(
            'Error loading dashboard:',
            error
        );
    }
}


/* =========================================================
   REGISTRATION - MILESTONE 1
   ========================================================= */

async function handleRegistrationSubmit(event) {

    event.preventDefault();

    try {

        const eventId =
            getNumber('regEventId');

        if (!eventId) {

            throw new Error(
                'Please select an event.'
            );
        }

        const data =
            await api('/register', {

                method: 'POST',

                body:
                    JSON.stringify({

                        event_id:
                            eventId,

                        name:
                            getValue('regName'),

                        email:
                            getValue('regEmail'),

                        phone:
                            getValue('regPhone'),

                        college:
                            getValue('regCollege'),

                        department:
                            getValue(
                                'regDepartment'
                            )
                    })
            });

        const ticket =
            data.ticket || {};

        const result =
            $('registrationResult');

        if (result) {

            result.className =
                'result-box';

            result.innerHTML = `

                <div class="ticket">

                    <b>
                        Registration Successful!
                    </b>

                    <h3>
                        ${escapeHtml(
                            ticket.ticketId || ''
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            ticket.name || ''
                        )}
                    </p>

                    <p>
                        ${escapeHtml(
                            ticket.eventName || ''
                        )}
                    </p>

                    ${
                        ticket.qrCode

                        ? `
                            <img
                                src="${escapeHtml(
                                    ticket.qrCode
                                )}"
                                alt="Ticket QR Code"
                            >
                          `

                        : ''
                    }

                    <small>
                        Use this Ticket ID for check-in.
                    </small>

                </div>
            `;
        }

        event.target.reset();

        await loadDashboard();

    } catch (error) {

        msg(
            'registrationResult',
            error.message,
            true
        );
    }
}


/* =========================================================
   ATTENDEES - MILESTONE 1
   ========================================================= */

async function loadAttendees() {

    const eventId =
        getNumber(
            'attendeeEventFilter'
        );

    if (!eventId) {

        const body =
            $('attendeesBody');

        if (body) {

            body.innerHTML =
                '<tr>' +
                '<td colspan="6">' +
                'Please select an event.' +
                '</td>' +
                '</tr>';
        }

        return;
    }

    try {

        const rows =
            await api(
                '/attendees/' + eventId
            );

        const body =
            $('attendeesBody');

        if (!body) return;

        body.innerHTML =

            rows.length

                ? rows.map((attendee) => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                attendee.ticket_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                attendee.name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                attendee.email
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                attendee.phone
                            )}
                        </td>

                        <td>
                            <span class="badge">
                                ${escapeHtml(
                                    attendee.status
                                )}
                            </span>
                        </td>

                        <td>

                            ${
                                attendee.qr_code

                                ? `
                                    <img
                                        class="qr"
                                        src="${escapeHtml(
                                            attendee.qr_code
                                        )}"
                                        alt="QR Code"
                                    >
                                  `

                                : ''
                            }

                        </td>

                    </tr>

                `).join('')

                : `
                    <tr>
                        <td colspan="6">
                            No attendees registered
                        </td>
                    </tr>
                  `;

    } catch (error) {

        console.error(
            'Error loading attendees:',
            error
        );
    }
}


/* =========================================================
   CHECK-IN - MILESTONE 1
   ========================================================= */

async function checkIn() {

    const ticketId =
        getValue('checkinTicket');

    if (!ticketId) {

        msg(
            'checkinResult',
            'Please enter a Ticket ID.',
            true
        );

        return;
    }

    try {

        const data =
            await api('/checkin', {

                method: 'POST',

                body:
                    JSON.stringify({
                        ticket_id:
                            ticketId
                    })
            });

        msg(
            'checkinResult',

            `✅ ${
                data.message ||
                'Check-in successful'
            } Name: ${
                data.attendee?.name || ''
            }`
        );

        setValue(
            'checkinTicket',
            ''
        );

        await loadDashboard();

    } catch (error) {

        msg(
            'checkinResult',
            error.message,
            true
        );
    }
}


/* =========================================================
   VENDORS - MILESTONE 2
   ========================================================= */

async function handleVendorSubmit(event) {

    event.preventDefault();

    try {

        const data =
            await api('/vendors', {

                method: 'POST',

                body:
                    JSON.stringify({

                        name:
                            getValue(
                                'vendorName'
                            ),

                        service_type:
                            $('vendorService')
                                ?.value || '',

                        contact_number:
                            getValue(
                                'vendorPhone'
                            ),

                        email:
                            getValue(
                                'vendorEmail'
                            ),

                        availability:
                            getValue(
                                'vendorAvailability'
                            )
                    })
            });

        msg(
            'vendorResult',
            data.message ||
            'Vendor added successfully.'
        );

        event.target.reset();

        await Promise.all([
            loadVendors(),
            loadDashboard()
        ]);

    } catch (error) {

        msg(
            'vendorResult',
            error.message,
            true
        );
    }
}


async function loadVendors() {

    try {

        const rows =
            await api('/vendors');

        const body =
            $('vendorsBody');

        if (body) {

            body.innerHTML =

                rows.length

                    ? rows.map((vendor) => {

                        const rating =
                            Number(
                                vendor.rating || 0
                            );

                        const stars =
                            rating > 0

                                ? '⭐'.repeat(
                                    Math.max(
                                        1,
                                        Math.min(
                                            5,
                                            Math.round(
                                                rating
                                            )
                                        )
                                    )
                                ) +
                                ` ${rating}`

                                : 'Not rated';

                        return `

                            <tr>

                                <td>
                                    ${escapeHtml(
                                        vendor.vendor_id
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        vendor.name
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        vendor.service_type
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        vendor.contact_number ||
                                        '—'
                                    )}
                                </td>

                                <td>
                                    ${stars}
                                </td>

                            </tr>

                        `;

                    }).join('')

                    : `
                        <tr>
                            <td colspan="5">
                                No vendors yet
                            </td>
                        </tr>
                      `;
        }

        const vendorSelect =
            $('assignVendorId');

        if (vendorSelect) {

            vendorSelect.innerHTML =

                '<option value="">' +
                'Select Vendor' +
                '</option>' +

                rows.map((vendor) => `

                    <option
                        value="${escapeHtml(
                            vendor.vendor_id
                        )}"
                    >
                        ${escapeHtml(
                            vendor.name
                        )}
                        –
                        ${escapeHtml(
                            vendor.service_type
                        )}
                    </option>

                `).join('');
        }

        return rows;

    } catch (error) {

        console.error(
            'Error loading vendors:',
            error
        );

        const body =
            $('vendorsBody');

        if (body) {

            body.innerHTML =
                `<tr>
                    <td colspan="5">
                        ${escapeHtml(
                            error.message
                        )}
                    </td>
                </tr>`;
        }

        return [];
    }
}


async function handleAssignmentSubmit(event) {

    event.preventDefault();

    try {

        const eventId =
            getNumber(
                'assignEventId'
            );

        const vendorId =
            getValue(
                'assignVendorId'
            );

        if (!eventId || !vendorId) {

            throw new Error(
                'Please select both Event and Vendor.'
            );
        }

        const data =
            await api(
                '/assign-vendor',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            event_id:
                                eventId,

                            vendor_id:
                                vendorId,

                            service:
                                getValue(
                                    'assignService'
                                )
                        })
                }
            );

        msg(
            'assignResult',
            data.message ||
            'Vendor assigned successfully.'
        );

        event.target.reset();

        await loadAssignments();

    } catch (error) {

        msg(
            'assignResult',
            error.message,
            true
        );
    }
}


async function loadAssignments() {

    try {

        const rows =
            await api(
                '/vendor-assignments'
            );

        const body =
            $('assignmentsBody');

        if (!body) return rows;

        body.innerHTML =

            rows.length

                ? rows.map(
                    (assignment) => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                assignment.event_name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                assignment.vendor_name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                assignment.service
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                assignment.status
                            )}
                        </td>

                        <td>
                            ${
                                assignment.assigned_at

                                ? new Date(
                                    assignment.assigned_at
                                ).toLocaleDateString()

                                : '—'
                            }
                        </td>

                    </tr>

                `
                ).join('')

                : `
                    <tr>
                        <td colspan="5">
                            No assignments
                        </td>
                    </tr>
                  `;

        return rows;

    } catch (error) {

        console.error(
            'Error loading assignments:',
            error
        );

        return [];
    }
}


async function rateVendor() {

    try {

        const vendorId =
            getValue(
                'rateVendorId'
            );

        const rating =
            getNumber(
                'rateValue'
            );

        if (!vendorId) {

            throw new Error(
                'Please enter a Vendor ID.'
            );
        }

        if (
            rating < 1 ||
            rating > 5
        ) {

            throw new Error(
                'Rating must be between 1 and 5.'
            );
        }

        const data =
            await api(
                '/vendors/' +
                encodeURIComponent(
                    vendorId
                ) +
                '/rate',
                {

                    method: 'PUT',

                    body:
                        JSON.stringify({
                            rating
                        })
                }
            );

        alert(
            data.message ||
            'Vendor rated successfully.'
        );

        setValue(
            'rateVendorId',
            ''
        );

        await loadVendors();

    } catch (error) {

        alert(error.message);
    }
}
/* =========================================================
   EVENT RATING / FINAL REPORT - MILESTONE 2
   Supports the older rating UI if it exists in your HTML.
   ========================================================= */

async function submitRatings(
    eventId,
    eventRating
) {

    try {

        if (
            !eventId ||
            !eventRating
        ) {

            throw new Error(
                'Event ID and event rating are required.'
            );
        }

        const vendors =
            await api(
                '/event-vendors/' +
                eventId
            );

        const vendorRatings = [];

        for (
            const vendor of vendors || []
        ) {

            const value =
                prompt(
                    `Rate vendor ${vendor.name} (1-5):`
                );

            if (
                value !== null &&
                value !== ''
            ) {

                const rating =
                    Number(value);

                if (
                    rating >= 1 &&
                    rating <= 5
                ) {

                    vendorRatings.push({

                        vendor_id:
                            vendor.vendor_id,

                        rating
                    });
                }
            }
        }

        const data =
            await api(
                '/rate-event',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            event_id:
                                Number(eventId),

                            event_rating:
                                Number(
                                    eventRating
                                ),

                            vendor_ratings:
                                vendorRatings
                        })
                }
            );

        alert(
            data.message ||
            'Ratings saved successfully.'
        );

        await viewFinalReport(
            eventId
        );

    } catch (error) {

        alert(error.message);
    }
}


async function viewFinalReport(
    eventId
) {

    try {

        const report =
            await api(
                '/report/' +
                eventId
            );

        const reportDiv =
            $('reportResult');

        if (!reportDiv) {

            alert(

                `Event Success Score: ${
                    report.success_score
                } / 5.00\n` +

                `Registered: ${
                    report.total_registered
                }\n` +

                `Checked In: ${
                    report.checked_in
                }`
            );

            return;
        }

        const vendors =
            report.vendors || [];

        reportDiv.innerHTML = `

            <div class="result-box">

                <h3>
                    Event Success Report
                </h3>

                <p>
                    <strong>
                        Total Registered:
                    </strong>

                    ${escapeHtml(
                        report.total_registered
                    )}
                </p>

                <p>
                    <strong>
                        Checked In:
                    </strong>

                    ${escapeHtml(
                        report.checked_in
                    )}
                </p>

                <p>
                    <strong>
                        Avg Event Rating:
                    </strong>

                    ${escapeHtml(
                        report.avg_event_rating
                    )}
                </p>

                <p>
                    <strong>
                        Avg Vendor Rating:
                    </strong>

                    ${escapeHtml(
                        report.avg_vendor_rating
                    )}
                </p>

                <h4>
                    Vendor Ratings
                </h4>

                <ul>

                    ${
                        vendors.length

                        ? vendors.map(
                            (vendor) => `

                                <li>
                                    ${escapeHtml(
                                        vendor.name
                                    )}:

                                    ${escapeHtml(
                                        vendor.rating ||
                                        'Not Rated'
                                    )}
                                    / 5
                                </li>
                            `
                        ).join('')

                        : '<li>No vendors assigned</li>'
                    }

                </ul>

                <h3>
                    Event Success Score:
                    ${escapeHtml(
                        report.success_score
                    )}
                    / 5.00
                </h3>

            </div>
        `;

    } catch (error) {

        console.error(
            'Error loading final report:',
            error
        );

        alert(error.message);
    }
}


/* =========================================================
   FINANCE - MILESTONE 3
   ========================================================= */

async function loadFinance() {

    const eventId =
        getNumber(
            'financeEvent'
        );

    if (!eventId) {

        setText(
            'budgetTotal',
            money(0)
        );

        setText(
            'expenseTotal',
            money(0)
        );

        setText(
            'sponsorTotal',
            money(0)
        );

        setText(
            'remainingTotal',
            money(0)
        );

        setText(
            'utilization',
            '0%'
        );

        setValue(
            'budgetAmount',
            ''
        );

        return null;
    }

    try {

        const data =
            await api(
                '/budget/' +
                eventId
            );

        const budget =
            Number(
                data.budget || 0
            );

        const expenses =
            Number(
                data.total_expenses || 0
            );

        const sponsorship =
            Number(
                data.total_sponsorship || 0
            );

        const remaining =
            Number(
                data.remaining_budget ??
                (
                    budget -
                    expenses
                )
            );

        const utilization =
            Number(
                data.budget_utilization ??
                (
                    budget
                        ? (
                            expenses /
                            budget
                        ) * 100
                        : 0
                )
            );

        setText(
            'budgetTotal',
            money(budget)
        );

        setText(
            'expenseTotal',
            money(expenses)
        );

        setText(
            'sponsorTotal',
            money(sponsorship)
        );

        setText(
            'remainingTotal',
            money(remaining)
        );

        setText(
            'utilization',

            utilization
                .toFixed(2)
                .replace(
                    /\.00$/,
                    ''
                ) +
                '%'
        );

        setValue(
            'budgetAmount',

            budget > 0
                ? budget
                : ''
        );

        return data;

    } catch (error) {

        msg(
            'financeMessage',
            error.message,
            true
        );

        return null;
    }
}


async function saveBudget() {

    try {

        const eventId =
            getNumber(
                'financeEvent'
            );

        const amount =
            getNumber(
                'budgetAmount'
            );

        if (!eventId) {

            throw new Error(
                'Please select an event.'
            );
        }

        if (amount < 0) {

            throw new Error(
                'Budget cannot be negative.'
            );
        }

        const data =
            await api(
                '/budget',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            event_id:
                                eventId,

                            amount
                        })
                }
            );

        msg(
            'financeMessage',

            data.message ||
            'Budget saved successfully.'
        );

        await loadFinance();

        await loadDashboard();

    } catch (error) {

        msg(
            'financeMessage',
            error.message,
            true
        );
    }
}


async function addExpense() {

    try {

        const eventId =
            getNumber(
                'financeEvent'
            );

        const amount =
            getNumber(
                'expenseAmount'
            );

        if (!eventId) {

            throw new Error(
                'Please select an event.'
            );
        }

        if (amount <= 0) {

            throw new Error(
                'Expense amount must be greater than 0.'
            );
        }

        const data =
            await api(
                '/expenses',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            event_id:
                                eventId,

                            category:
                                $('expenseCategory')
                                    ?.value || '',

                            description:
                                getValue(
                                    'expenseDescription'
                                ),

                            amount,

                            approval_status:
                                $('expenseApproval')
                                    ?.value ||
                                'Approved'
                        })
                }
            );

        msg(
            'financeMessage',

            data.message ||
            'Expense added successfully.'
        );

        setValue(
            'expenseDescription',
            ''
        );

        setValue(
            'expenseAmount',
            ''
        );

        await loadFinance();

        await loadApprovals();

        await loadDashboard();

    } catch (error) {

        msg(
            'financeMessage',
            error.message,
            true
        );
    }
}


async function addSponsor() {

    try {

        const eventId =
            getNumber(
                'financeEvent'
            );

        const amount =
            getNumber(
                'sponsorAmount'
            );

        const name =
            getValue(
                'sponsorName'
            );

        if (!eventId) {

            throw new Error(
                'Please select an event.'
            );
        }

        if (!name) {

            throw new Error(
                'Please enter sponsor name.'
            );
        }

        if (amount <= 0) {

            throw new Error(
                'Sponsorship amount must be greater than 0.'
            );
        }

        const data =
            await api(
                '/sponsors',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            event_id:
                                eventId,

                            name,

                            amount
                        })
                }
            );

        msg(
            'financeMessage',

            data.message ||
            'Sponsorship saved successfully.'
        );

        setValue(
            'sponsorName',
            ''
        );

        setValue(
            'sponsorAmount',
            ''
        );

        await loadFinance();

        await loadDashboard();

    } catch (error) {

        msg(
            'financeMessage',
            error.message,
            true
        );
    }
}


/* =========================================================
   AUTOMATION - MILESTONE 3
   ========================================================= */

async function scheduleReminder() {

    try {

        const eventId =
            getNumber(
                'reminderEvent'
            );

        const reminderDate =
            getValue(
                'reminderDate'
            );

        const message =
            getValue(
                'reminderMessage'
            );

        if (!eventId) {

            throw new Error(
                'Please select an event.'
            );
        }

        if (!reminderDate) {

            throw new Error(
                'Please select a reminder date.'
            );
        }

        const data =
            await api(
                '/reminders',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            event_id:
                                eventId,

                            reminder_date:
                                reminderDate,

                            message:
                                message ||
                                'Event reminder'
                        })
                }
            );

        alert(
            data.message ||
            'Reminder scheduled.'
        );

    } catch (error) {

        alert(error.message);
    }
}


async function runAutomation() {

    try {

        const data =
            await api(
                '/automation/run',
                {
                    method: 'POST'
                }
            );

        alert(
            data.message ||
            'Automation cycle completed.'
        );

        await loadNotifications();

    } catch (error) {

        alert(error.message);
    }
}


async function loadApprovals() {

    try {

        const rows =
            await api(
                '/approvals'
            );

        const body =
            $('approvalsBody');

        if (!body) return;

        body.innerHTML =

            rows.length

                ? rows.map(
                    (approval) => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                approval.event_name ||
                                approval.event_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                approval.item_type
                            )}
                        </td>

                        <td>
                            ${money(
                                approval.amount
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                approval.status
                            )}
                        </td>

                        <td>

                            ${
                                approval.status ===
                                'Pending'

                                ? `

                                    <button
                                        class="btn-secondary"
                                        onclick="
                                            decideApproval(
                                                ${Number(
                                                    approval.id
                                                )},
                                                'Approved'
                                            )
                                        "
                                    >
                                        Approve
                                    </button>

                                    <button
                                        class="btn-secondary"
                                        onclick="
                                            decideApproval(
                                                ${Number(
                                                    approval.id
                                                )},
                                                'Rejected'
                                            )
                                        "
                                    >
                                        Reject
                                    </button>

                                  `

                                : '—'
                            }

                        </td>

                    </tr>

                `
                ).join('')

                : `
                    <tr>
                        <td colspan="5">
                            No approvals
                        </td>
                    </tr>
                  `;

    } catch (error) {

        console.error(
            'Error loading approvals:',
            error
        );
    }
}


async function decideApproval(
    id,
    status
) {

    try {

        await api(
            '/approvals/' + id,
            {

                method: 'PUT',

                body:
                    JSON.stringify({
                        status
                    })
            }
        );

        await Promise.all([

            loadApprovals(),

            loadNotifications(),

            loadFinance(),

            loadDashboard()

        ]);

    } catch (error) {

        alert(error.message);
    }
}


async function loadNotifications() {

    try {

        const rows =
            await api(
                '/notifications'
            );

        const body =
            $('notificationsBody');

        if (!body) return;

        body.innerHTML =

            rows.length

                ? rows
                    .slice(0, 20)
                    .map(
                        (notification) => `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    notification.type
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    notification.recipient ||
                                    '—'
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    notification.message
                                )}
                            </td>

                            <td>
                                ${
                                    notification.created_at

                                    ? new Date(
                                        notification.created_at
                                    ).toLocaleString()

                                    : '—'
                                }
                            </td>

                        </tr>

                    `
                    )
                    .join('')

                : `
                    <tr>
                        <td colspan="4">
                            No notifications
                        </td>
                    </tr>
                  `;

    } catch (error) {

        console.error(
            'Error loading notifications:',
            error
        );
    }
}
/* =========================================================
   ANALYTICS - MILESTONE 4
   ========================================================= */

async function loadAnalytics() {

    const eventId =
        getNumber(
            'analyticsEvent'
        );

    if (!eventId) return;

    try {

        const data =
            await api(
                '/analytics/' +
                eventId
            );

        const budget =
            Number(
                data.budget || 0
            );

        const expenses =
            Number(
                data.expenses || 0
            );

        setText(
            'kpiRegs',
            data.registrations || 0
        );

        setText(
            'kpiAttendance',

            Number(
                data.attendance_rate || 0
            ) +
            '%'
        );

        setText(
            'kpiBudget',

            budget

                ? (
                    (
                        expenses /
                        budget
                    ) * 100
                ).toFixed(2) + '%'

                : '0%'
        );

        setText(
            'kpiSponsor',
            money(data.sponsorship)
        );

    } catch (error) {

        console.error(
            'Error loading analytics:',
            error
        );
    }
}


async function loadComparison() {

    try {

        const rows =
            await api(
                '/event-comparison'
            );

        const chart =
            $('comparisonChart');

        if (!chart) return;

        chart.innerHTML =

            rows.length

                ? rows.map(
                    (row) => {

                        const rate =
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    Number(
                                        row.attendance_rate ||
                                        0
                                    )
                                )
                            );

                        return `

                            <div class="bar-row">

                                <span>
                                    ${escapeHtml(
                                        row.name
                                    )}
                                </span>

                                <div class="bar">

                                    <i
                                        style="
                                            width:${rate}%
                                        "
                                    ></i>

                                </div>

                                <b>
                                    ${rate}%
                                </b>

                            </div>

                        `;
                    }
                ).join('')

                : 'No data';

    } catch (error) {

        console.error(
            'Error loading comparison:',
            error
        );
    }
}


async function loadForecast() {

    try {

        const data =
            await api(
                '/forecast'
            );

        const result =
            $('forecastResult');

        if (!result) return;

        result.innerHTML = `

            <p>

                <b>
                    Average historical attendance:
                </b>

                ${escapeHtml(
                    data.average_attendance
                )}

            </p>

            <p>

                <b>
                    Forecast:
                </b>

                ${escapeHtml(
                    data.forecast_for_next_event
                )}

                attendees

            </p>

            <p>
                ${escapeHtml(
                    data.recommendation || ''
                )}
            </p>

        `;

    } catch (error) {

        console.error(
            'Error loading forecast:',
            error
        );
    }
}


function downloadCSV() {

    window.location.href =
        API +
        '/reports/attendees.csv';
}


function downloadPDF() {

    const eventId =
        getNumber(
            'analyticsEvent'
        );

    if (!eventId) {

        alert(
            'Please select an event first.'
        );

        return;
    }

    window.location.href =
        API +
        '/reports/event/' +
        eventId +
        '.pdf';
}


/* =========================================================
   RESOURCES - MILESTONE 4
   ========================================================= */

async function addResource() {

    try {

        const name =
            getValue(
                'resourceName'
            );

        const category =
            getValue(
                'resourceCategory'
            );

        const quantity =
            getNumber(
                'resourceQty'
            );

        if (
            !name ||
            !category ||
            quantity <= 0
        ) {

            throw new Error(
                'Enter resource name, category and a positive quantity.'
            );
        }

        const data =
            await api(
                '/resources',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            name,

                            category,

                            quantity
                        })
                }
            );

        alert(
            data.message ||
            'Resource added successfully.'
        );

        setValue(
            'resourceName',
            ''
        );

        setValue(
            'resourceQty',
            ''
        );

        await loadResources();

    } catch (error) {

        alert(error.message);
    }
}


async function loadResources() {

    try {

        const rows =
            await api(
                '/resources'
            );

        const body =
            $('resourcesBody');

        if (body) {

            body.innerHTML =

                rows.length

                    ? rows.map(
                        (resource) => {

                            const quantity =
                                Number(
                                    resource.quantity ||
                                    0
                                );

                            const available =
                                Number(
                                    resource.available ||
                                    0
                                );

                            const used =
                                quantity > 0

                                    ? (
                                        (
                                            quantity -
                                            available
                                        ) /
                                        quantity
                                    ) * 100

                                    : 0;

                            return `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            resource.name
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            resource.category
                                        )}
                                    </td>

                                    <td>
                                        ${quantity}
                                    </td>

                                    <td>
                                        ${available}
                                    </td>

                                    <td>
                                        ${used.toFixed(2)}%
                                    </td>

                                </tr>

                            `;
                        }
                    ).join('')

                    : `
                        <tr>
                            <td colspan="5">
                                No resources
                            </td>
                        </tr>
                      `;
        }

        const select =
            $('resourceSelect');

        if (select) {

            select.innerHTML =

                '<option value="">' +
                'Select Resource' +
                '</option>' +

                rows.map(
                    (resource) => `

                        <option
                            value="${escapeHtml(
                                resource.id
                            )}"
                        >
                            ${escapeHtml(
                                resource.name
                            )}

                            (
                            ${Number(
                                resource.available || 0
                            )}
                            available
                            )

                        </option>

                    `
                ).join('');
        }

        return rows;

    } catch (error) {

        console.error(
            'Error loading resources:',
            error
        );

        return [];
    }
}


async function allocateResource() {

    try {

        const resourceId =
            getNumber(
                'resourceSelect'
            );

        const eventId =
            getNumber(
                'resourceEvent'
            );

        const quantity =
            getNumber(
                'allocationQty'
            );

        if (
            !resourceId ||
            !eventId ||
            quantity <= 0
        ) {

            throw new Error(
                'Select a resource, event and enter a positive quantity.'
            );
        }

        const data =
            await api(
                '/resource-allocations',
                {

                    method: 'POST',

                    body:
                        JSON.stringify({

                            resource_id:
                                resourceId,

                            event_id:
                                eventId,

                            quantity
                        })
                }
            );

        alert(
            data.message ||
            'Resource allocated successfully.'
        );

        setValue(
            'allocationQty',
            ''
        );

        await loadResources();

    } catch (error) {

        alert(error.message);
    }
}


/* =========================================================
   TABS
   ========================================================= */

function setupTabs() {

    document
        .querySelectorAll(
            '.nav-links a'
        )
        .forEach((link) => {

            link.addEventListener(
                'click',
                (event) => {

                    event.preventDefault();

                    document
                        .querySelectorAll(
                            '.nav-links a'
                        )
                        .forEach(
                            (item) => {

                                item.classList.remove(
                                    'active'
                                );

                            }
                        );

                    link.classList.add(
                        'active'
                    );

                    document
                        .querySelectorAll(
                            '.tab-content'
                        )
                        .forEach(
                            (section) => {

                                section.classList.remove(
                                    'active'
                                );

                            }
                        );

                    const target =
                        $(
                            link.dataset.tab
                        );

                    if (target) {

                        target.classList.add(
                            'active'
                        );
                    }

                    if (
                        link.dataset.tab ===
                        'finance'
                    ) {

                        loadFinance();
                    }

                    if (
                        link.dataset.tab ===
                        'analytics'
                    ) {

                        loadAnalytics();
                    }

                    if (
                        link.dataset.tab ===
                        'automation'
                    ) {

                        loadApprovals();

                        loadNotifications();
                    }

                    if (
                        link.dataset.tab ===
                        'resources'
                    ) {

                        loadResources();
                    }

                }
            );

        });


    document
        .querySelectorAll(
            '.subtab'
        )
        .forEach((button) => {

            button.addEventListener(
                'click',
                () => {

                    document
                        .querySelectorAll(
                            '.subtab'
                        )
                        .forEach(
                            (item) => {

                                item.classList.remove(
                                    'active'
                                );

                            }
                        );

                    button.classList.add(
                        'active'
                    );

                    document
                        .querySelectorAll(
                            '.subcontent'
                        )
                        .forEach(
                            (content) => {

                                content.classList.remove(
                                    'active'
                                );

                            }
                        );

                    const targetId =
                        button.dataset.sub;

                    let target =
                        $(targetId);

                    /*
                       Supports both:
                       vendorList
                       and old IDs such as list
                    */

                    if (
                        !target &&
                        targetId
                    ) {

                        target =
                            $(
                                'vtab-' +
                                targetId
                            );
                    }

                    if (target) {

                        target.classList.add(
                            'active'
                        );
                    }

                    if (
                        targetId ===
                        'vendorList' ||
                        targetId ===
                        'list'
                    ) {

                        loadVendors();
                    }

                    if (
                        targetId ===
                        'vendorAssignments' ||
                        targetId ===
                        'assignments'
                    ) {

                        loadAssignments();
                    }

                }
            );

        });

}


/* =========================================================
   FORM EVENTS
   ========================================================= */

function setupForms() {

    const registrationForm =
        $('registrationForm');

    if (registrationForm) {

        registrationForm.addEventListener(
            'submit',
            handleRegistrationSubmit
        );
    }


    const vendorForm =
        $('vendorForm');

    if (vendorForm) {

        vendorForm.addEventListener(
            'submit',
            handleVendorSubmit
        );
    }


    const assignmentForm =
        $('assignForm');

    if (assignmentForm) {

        assignmentForm.addEventListener(
            'submit',
            handleAssignmentSubmit
        );
    }


    const attendeeFilter =
        $('attendeeEventFilter');

    if (attendeeFilter) {

        attendeeFilter.addEventListener(
            'change',
            loadAttendees
        );
    }


    const financeEvent =
        $('financeEvent');

    if (financeEvent) {

        financeEvent.addEventListener(
            'change',
            loadFinance
        );
    }


    const analyticsEvent =
        $('analyticsEvent');

    if (analyticsEvent) {

        analyticsEvent.addEventListener(
            'change',
            loadAnalytics
        );
    }

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

    setupTabs();

    setupForms();

    try {

        await loadEvents();

    } catch (error) {

        console.error(error);
    }

    /*
       Run independent requests separately.
       If one API fails, the others still load.
    */

    await Promise.allSettled([

        loadDashboard(),

        loadVendors(),

        loadAssignments(),

        loadComparison(),

        loadForecast(),

        loadApprovals(),

        loadNotifications(),

        loadResources()

    ]);
}


/* =========================================================
   GLOBAL FUNCTIONS FOR HTML onclick="..."
   ========================================================= */

Object.assign(
    window,
    {

        loadEvents,

        loadDashboard,

        loadAttendees,

        checkIn,

        loadVendors,

        loadAssignments,

        rateVendor,

        submitRatings,

        viewFinalReport,

        loadFinance,

        saveBudget,

        addExpense,

        addSponsor,

        scheduleReminder,

        runAutomation,

        loadApprovals,

        decideApproval,

        loadNotifications,

        loadAnalytics,

        loadComparison,

        loadForecast,

        downloadCSV,

        downloadPDF,

        addResource,

        loadResources,

        allocateResource

    }
);


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    init
);