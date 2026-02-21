// ============================================
// ARTIZ PLATFORM — SUPABASE BACKEND
// ============================================

const SUPABASE_URL = 'https://kwtcjrcouakkzevvulxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dGNqcmNvdWFra3pldnZ1bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDEzODgsImV4cCI6MjA4NTE3NzM4OH0.no2HsSeNj_p2l91aQQvf5H6giT9WwxBbWDJlAM2HBPs';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// LOADING SPINNER
// ============================================

function showLoading(text = 'Please wait...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (overlay) { overlay.classList.add('active'); }
    if (loadingText) { loadingText.textContent = text; }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) { overlay.classList.remove('active'); }
}

// ============================================
// AUTHENTICATION
// ============================================

async function registerUser(event, userType) {
    event.preventDefault();

    const email = userType === 'customer'
        ? document.getElementById('custEmail').value
        : document.getElementById('artEmail').value;
    const password = userType === 'customer'
        ? document.getElementById('custPassword').value
        : document.getElementById('artPassword').value;
    const fullName = userType === 'customer'
        ? document.getElementById('custName').value
        : document.getElementById('artName').value;
    const phone = userType === 'customer'
        ? document.getElementById('custPhone').value
        : document.getElementById('artPhone').value;

    if (!email || !password || !fullName) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    showLoading('Creating your account...');
    try {
        const { data: authData, error: authError } = await _supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;

        const profileData = {
            id: authData.user.id,
            full_name: fullName,
            phone_number: phone,
            email: email,
            user_type: userType,
        };

        if (userType === 'customer') {
            profileData.location = document.getElementById('custLocation').value;
        } else {
            profileData.trade = document.getElementById('artTrade').value;
            profileData.experience = document.getElementById('artExperience').value;
        }

        const { error: profileError } = await _supabase
            .from('profiles')
            .insert([profileData]);

        if (profileError) throw profileError;

        showToast('Registration successful! Please check your email to verify, then log in.', 'success');
        showPage('login');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loginUser(event) {
    event.preventDefault();
    const email = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPassword').value;

    showLoading('Signing you in...');
    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (!profile) throw new Error('Profile not found. Please register first.');

        localStorage.setItem('userType', profile.user_type);
        localStorage.setItem('userId', profile.id);
        updateUIForLoggedInUser(profile);

        // Navigate to appropriate dashboard
        if (profile.user_type === 'admin') {
            showPage('admin-dashboard');
            loadAdminDashboard();
        } else if (profile.user_type === 'artisan') {
            showPage('artisan-dashboard');
            loadArtisanDashboard(profile.id);
        } else {
            showPage('customer-dashboard');
            loadCustomerDashboard(profile.id);
        }

        showToast(`Welcome back, ${profile.full_name.split(' ')[0]}!`, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function logout() {
    await _supabase.auth.signOut();
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    document.querySelector('.logged-out').style.display = 'flex';
    document.querySelector('.logged-in').style.display = 'none';
    showPage('landing');
    showToast('Logged out successfully.', 'success');
}

async function resetPassword(event) {
    event.preventDefault();
    const email = document.getElementById('resetEmail')?.value;
    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }
    try {
        const { error } = await _supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showToast('Password reset email sent! Check your inbox.', 'success');
        showPage('login');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// ARTISAN SEARCH & FILTERING
// ============================================

async function loadArtisans(filters = {}) {
    let query = _supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'artisan')
        .order('rating', { ascending: false });

    if (filters.category) {
        query = query.ilike('trade', `%${filters.category}%`);
    }
    if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
    }
    if (filters.rating) {
        query = query.gte('rating', parseFloat(filters.rating));
    }
    if (filters.verification) {
        query = query.eq('verification_level', filters.verification);
    }
    if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,trade.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error loading artisans:', error);
        showToast('Failed to load artisans.', 'error');
        return;
    }

    renderArtisanCards(data);
}

function getSearchFilters() {
    return {
        search: document.getElementById('serviceSearch')?.value || '',
        category: document.getElementById('categoryFilter')?.value || '',
        location: document.getElementById('locationFilter')?.value || '',
        rating: document.getElementById('ratingFilter')?.value || '',
        verification: document.getElementById('verificationFilter')?.value || '',
    };
}

function applyFilters() {
    const filters = getSearchFilters();
    loadArtisans(filters);
}

function renderArtisanCards(artisans) {
    const grid = document.querySelector('.artisans-grid');
    if (!grid) return;

    if (Array.isArray(artisans) && artisans.length > 0) {
        grid.innerHTML = artisans.map(artisan => {
            const stars = renderStars(artisan.rating || 0);
            const avatarUrl = artisan.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.full_name)}&background=random`;
            const badge = artisan.verification_level !== 'basic'
                ? `<span class="badge ${artisan.verification_level}">${formatBadge(artisan.verification_level)}</span>`
                : '';

            return `
                <div class="artisan-card">
                    <div class="artisan-header">
                        <div class="artisan-avatar">
                            <img src="${avatarUrl}" alt="${artisan.full_name}">
                        </div>
                        <div class="artisan-info">
                            <h3>${artisan.full_name}</h3>
                            <p class="trade">${artisan.trade || 'General Artisan'}</p>
                            <div class="rating">
                                ${stars}
                                <span>${(artisan.rating || 0).toFixed(1)} (${artisan.total_reviews || 0} reviews)</span>
                            </div>
                        </div>
                        ${badge}
                    </div>
                    <div class="artisan-details">
                        <p><i class="fas fa-map-marker-alt"></i> ${artisan.location || 'Nigeria'}</p>
                        <p><i class="fas fa-clock"></i> ${artisan.experience || 'N/A'} experience</p>
                        <p><i class="fas fa-check-circle"></i> ${artisan.completion_rate || 0}% completion rate</p>
                    </div>
                    <div class="artisan-actions">
                        <button class="btn btn-outline" onclick="viewArtisanProfile('${artisan.id}')">View Profile</button>
                        <button class="btn btn-primary" onclick="bookArtisan('${artisan.id}')">Book Now</button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        grid.innerHTML = '<p class="no-data">No artisans found matching your criteria. Try adjusting the filters!</p>';
    }
}

// ============================================
// ARTISAN PROFILE VIEW
// ============================================

async function viewArtisanProfile(artisanId) {
    try {
        const { data: artisan, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', artisanId)
            .single();

        if (error) throw error;

        // Load artisan's services
        const { data: services } = await _supabase
            .from('services')
            .select('*')
            .eq('artisan_id', artisanId);

        // Load artisan's reviews
        const { data: reviews } = await _supabase
            .from('reviews')
            .select('*, reviewer:reviewer_id(full_name)')
            .eq('reviewed_id', artisanId)
            .order('created_at', { ascending: false })
            .limit(10);

        const profilePage = document.getElementById('artisan-profile');
        const avatarUrl = artisan.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.full_name)}&size=120&background=random`;

        profilePage.innerHTML = `
            <div class="page-header">
                <h2>${artisan.full_name}</h2>
                <button onclick="showPage('find-artisan')" class="btn btn-outline">← Back to Search</button>
            </div>
            <div class="profile-view">
                <div class="profile-top">
                    <div class="profile-avatar-large">
                        <img src="${avatarUrl}" alt="${artisan.full_name}">
                    </div>
                    <div class="profile-summary">
                        <h3>${artisan.trade || 'General Artisan'}</h3>
                        <div class="rating">${renderStars(artisan.rating || 0)} <span>${(artisan.rating || 0).toFixed(1)} (${artisan.total_reviews || 0} reviews)</span></div>
                        <p><i class="fas fa-map-marker-alt"></i> ${artisan.location || 'Nigeria'}</p>
                        <p><i class="fas fa-clock"></i> ${artisan.experience || 'N/A'} experience</p>
                        <p><i class="fas fa-check-circle"></i> ${artisan.completion_rate || 0}% completion rate</p>
                        ${artisan.bio ? `<p class="bio">${artisan.bio}</p>` : ''}
                        <button class="btn btn-primary" onclick="bookArtisan('${artisan.id}')">
                            <i class="fas fa-calendar-check"></i> Book Now
                        </button>
                    </div>
                </div>

                ${services && services.length > 0 ? `
                <div class="profile-section">
                    <h3>Services Offered</h3>
                    <div class="services-list">
                        ${services.map(s => `
                            <div class="service-tag">${s.name} ${s.price_min ? `— ₦${Number(s.price_min).toLocaleString()}${s.price_max ? ' - ₦' + Number(s.price_max).toLocaleString() : '+'}` : ''}</div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <div class="profile-section">
                    <h3>Reviews</h3>
                    ${reviews && reviews.length > 0 ? reviews.map(r => `
                        <div class="review-card">
                            <div class="review-header">
                                <strong>${r.reviewer?.full_name || 'Customer'}</strong>
                                <span>${renderStars(r.rating)}</span>
                            </div>
                            <p>${r.comment || ''}</p>
                            <small>${new Date(r.created_at).toLocaleDateString()}</small>
                        </div>
                    `).join('') : '<p class="no-data">No reviews yet.</p>'}
                </div>
            </div>
        `;

        showPage('artisan-profile');
    } catch (error) {
        showToast('Could not load artisan profile.', 'error');
        console.error(error);
    }
}

// ============================================
// BOOKING SYSTEM
// ============================================

async function bookArtisan(artisanId) {
    const { data: { session } } = await _supabase.auth.getSession();

    if (!session) {
        if (confirm('You need to log in to book an artisan. Go to login page?')) {
            showPage('login');
        }
        return;
    }

    // Get the artisan info for the modal
    const { data: artisan } = await _supabase
        .from('profiles')
        .select('full_name, trade')
        .eq('id', artisanId)
        .single();

    // Show booking modal
    const modal = document.getElementById('bookingModal');
    if (modal) {
        document.getElementById('bookingArtisanId').value = artisanId;
        document.getElementById('bookingArtisanName').textContent = artisan?.full_name || 'Artisan';
        document.getElementById('bookingArtisanTrade').textContent = artisan?.trade || '';
        modal.style.display = 'flex';
    }
}

async function submitBooking(event) {
    event.preventDefault();

    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const artisanId = document.getElementById('bookingArtisanId').value;
    const serviceName = document.getElementById('bookingService').value;
    const description = document.getElementById('bookingDescription').value;
    const scheduledDate = document.getElementById('bookingDate').value;
    const location = document.getElementById('bookingLocation').value;

    showLoading('Sending booking request...');
    try {
        const { error } = await _supabase
            .from('bookings')
            .insert([{
                customer_id: session.user.id,
                artisan_id: artisanId,
                service_name: serviceName,
                description: description,
                scheduled_date: scheduledDate || null,
                location: location,
                status: 'pending'
            }]);

        if (error) throw error;

        closeBookingModal();
        showToast('Booking request sent successfully! The artisan will respond soon.', 'success');
    } catch (error) {
        showToast('Failed to create booking: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) modal.style.display = 'none';
}

async function updateBookingStatus(bookingId, newStatus) {
    try {
        const { error } = await _supabase
            .from('bookings')
            .update({ status: newStatus })
            .eq('id', bookingId);

        if (error) throw error;

        const messages = {
            confirmed: 'Booking confirmed! Customer has been notified.',
            declined: 'Booking declined.',
            in_progress: 'Job marked as in progress.',
            completed: 'Job marked as completed!',
            cancelled: 'Booking cancelled.'
        };

        showToast(messages[newStatus] || 'Booking updated.', 'success');

        // Reload the appropriate dashboard
        const userType = localStorage.getItem('userType');
        const userId = localStorage.getItem('userId');
        if (userType === 'artisan') {
            loadArtisanDashboard(userId);
        } else {
            loadCustomerDashboard(userId);
        }
    } catch (error) {
        showToast('Failed to update booking.', 'error');
    }
}

// ============================================
// REVIEWS
// ============================================

async function submitReview(event) {
    event.preventDefault();

    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const bookingId = document.getElementById('reviewBookingId').value;
    const reviewedId = document.getElementById('reviewArtisanId').value;
    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value;

    try {
        // Insert the review
        const { error } = await _supabase
            .from('reviews')
            .insert([{
                booking_id: bookingId,
                reviewer_id: session.user.id,
                reviewed_id: reviewedId,
                rating: rating,
                comment: comment,
            }]);

        if (error) throw error;

        // Update the artisan's average rating
        const { data: reviews } = await _supabase
            .from('reviews')
            .select('rating')
            .eq('reviewed_id', reviewedId);

        if (reviews && reviews.length > 0) {
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            await _supabase
                .from('profiles')
                .update({
                    rating: avgRating.toFixed(2),
                    total_reviews: reviews.length
                })
                .eq('id', reviewedId);
        }

        closeReviewModal();
        showToast('Review submitted! Thank you for your feedback.', 'success');
    } catch (error) {
        showToast('Failed to submit review: ' + error.message, 'error');
    }
}

function showReviewModal(bookingId, artisanId) {
    document.getElementById('reviewBookingId').value = bookingId;
    document.getElementById('reviewArtisanId').value = artisanId;
    document.getElementById('reviewRating').value = '5';
    document.getElementById('reviewComment').value = '';
    document.getElementById('reviewModal').style.display = 'flex';
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// CUSTOMER DASHBOARD
// ============================================

async function loadCustomerDashboard(userId) {
    try {
        // Load customer's bookings
        const { data: bookings } = await _supabase
            .from('bookings')
            .select('*, artisan:artisan_id(full_name, trade)')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false });

        const activeBookings = (bookings || []).filter(b => ['pending', 'confirmed', 'in_progress'].includes(b.status));
        const completedBookings = (bookings || []).filter(b => b.status === 'completed');

        // Update stats
        const statsContainer = document.querySelector('#customer-dashboard .dashboard-stats');
        if (statsContainer) {
            const totalSpent = completedBookings.reduce((sum, b) => sum + (parseFloat(b.price_estimate) || 0), 0);
            statsContainer.innerHTML = `
                <div class="stat-card"><i class="fas fa-calendar-check"></i><h3>${activeBookings.length}</h3><p>Active Bookings</p></div>
                <div class="stat-card"><i class="fas fa-history"></i><h3>${completedBookings.length}</h3><p>Completed Jobs</p></div>
                <div class="stat-card"><i class="fas fa-wallet"></i><h3>₦${totalSpent.toLocaleString()}</h3><p>Total Spent</p></div>
            `;
        }

        // Render bookings list
        const bookingsSection = document.querySelector('#customer-dashboard .bookings-list');
        if (bookingsSection) {
            if (bookings && bookings.length > 0) {
                bookingsSection.innerHTML = bookings.slice(0, 10).map(b => `
                    <div class="booking-card">
                        <div class="booking-info">
                            <h4>${b.service_name}</h4>
                            <p><i class="fas fa-user"></i> ${b.artisan?.full_name || 'Unknown'}</p>
                            <p><i class="fas fa-calendar"></i> ${b.scheduled_date ? new Date(b.scheduled_date).toLocaleDateString() : 'Not scheduled'}</p>
                            <span class="status ${b.status}">${b.status.replace('_', ' ')}</span>
                        </div>
                        <div>
                            ${b.status === 'completed' ? `<button class="btn btn-small btn-secondary" onclick="showReviewModal('${b.id}', '${b.artisan_id}')">Leave Review</button>` : ''}
                            ${b.status === 'pending' ? `<button class="btn btn-small btn-outline" onclick="updateBookingStatus('${b.id}', 'cancelled')">Cancel</button>` : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                bookingsSection.innerHTML = '<p class="no-data">No bookings yet. <a href="#" onclick="showPage(\'find-artisan\')">Find an artisan</a> to get started!</p>';
            }
        }
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// ============================================
// ARTISAN DASHBOARD
// ============================================

async function loadArtisanDashboard(userId) {
    try {
        // Load artisan's bookings/requests
        const { data: bookings } = await _supabase
            .from('bookings')
            .select('*, customer:customer_id(full_name, location)')
            .eq('artisan_id', userId)
            .order('created_at', { ascending: false });

        const pendingRequests = (bookings || []).filter(b => b.status === 'pending');
        const activeJobs = (bookings || []).filter(b => ['confirmed', 'in_progress'].includes(b.status));
        const completedJobs = (bookings || []).filter(b => b.status === 'completed');

        // Load artisan's profile for stats
        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // Update stats
        const statsContainer = document.querySelector('#artisan-dashboard .dashboard-stats');
        if (statsContainer) {
            const monthlyEarnings = completedJobs
                .filter(b => new Date(b.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                .reduce((sum, b) => sum + (parseFloat(b.price_estimate) || 0), 0);

            statsContainer.innerHTML = `
                <div class="stat-card"><i class="fas fa-bell"></i><h3>${pendingRequests.length}</h3><p>New Requests</p></div>
                <div class="stat-card"><i class="fas fa-calendar-check"></i><h3>${activeJobs.length}</h3><p>Active Jobs</p></div>
                <div class="stat-card"><i class="fas fa-star"></i><h3>${(profile?.rating || 0).toFixed(1)}</h3><p>Your Rating</p></div>
                <div class="stat-card"><i class="fas fa-wallet"></i><h3>₦${monthlyEarnings.toLocaleString()}</h3><p>This Month</p></div>
            `;
        }

        // Render job requests
        const requestsList = document.querySelector('#artisan-dashboard .requests-list');
        if (requestsList) {
            const allRequests = [...pendingRequests, ...activeJobs];
            if (allRequests.length > 0) {
                requestsList.innerHTML = allRequests.map(b => `
                    <div class="request-card">
                        <div class="request-info">
                            <h4>${b.service_name}</h4>
                            <p><i class="fas fa-user"></i> ${b.customer?.full_name || 'Customer'}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${b.location || b.customer?.location || 'Not specified'}</p>
                            ${b.price_estimate ? `<p><i class="fas fa-money-bill"></i> ₦${Number(b.price_estimate).toLocaleString()}</p>` : ''}
                            <span class="status ${b.status}">${b.status.replace('_', ' ')}</span>
                        </div>
                        <div class="request-actions">
                            ${b.status === 'pending' ? `
                                <button class="btn btn-small btn-success" onclick="updateBookingStatus('${b.id}', 'confirmed')">Accept</button>
                                <button class="btn btn-small btn-outline" onclick="updateBookingStatus('${b.id}', 'declined')">Decline</button>
                            ` : ''}
                            ${b.status === 'confirmed' ? `
                                <button class="btn btn-small btn-primary" onclick="updateBookingStatus('${b.id}', 'in_progress')">Start Job</button>
                            ` : ''}
                            ${b.status === 'in_progress' ? `
                                <button class="btn btn-small btn-success" onclick="updateBookingStatus('${b.id}', 'completed')">Complete</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                requestsList.innerHTML = '<p class="no-data">No job requests yet. Make sure your profile is complete to attract customers!</p>';
            }
        }

        // Update performance bars
        const performanceSection = document.querySelector('#artisan-dashboard .performance');
        if (performanceSection && profile) {
            performanceSection.innerHTML = `
                <div class="metric">
                    <span>Response Rate</span>
                    <div class="progress-bar"><div class="progress" style="width: ${profile.response_rate || 0}%"></div></div>
                    <span>${profile.response_rate || 0}%</span>
                </div>
                <div class="metric">
                    <span>Completion Rate</span>
                    <div class="progress-bar"><div class="progress" style="width: ${profile.completion_rate || 0}%"></div></div>
                    <span>${profile.completion_rate || 0}%</span>
                </div>
                <div class="metric">
                    <span>Jobs Completed</span>
                    <div class="progress-bar"><div class="progress" style="width: ${Math.min(100, (profile.jobs_completed || 0))}%"></div></div>
                    <span>${profile.jobs_completed || 0}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Artisan dashboard error:', error);
    }
}

// ============================================
// ARTISAN SERVICES MANAGEMENT
// ============================================

async function loadArtisanServices() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const { data: services } = await _supabase
        .from('services')
        .select('*')
        .eq('artisan_id', session.user.id);

    const container = document.querySelector('#artisan-services .page-content');
    if (!container) return;

    container.innerHTML = `
        <form onsubmit="addService(event)" class="service-form">
            <h3>Add New Service</h3>
            <div class="form-group">
                <label>Service Name *</label>
                <input type="text" id="newServiceName" required placeholder="e.g. Pipe Installation">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Min Price (₦)</label>
                    <input type="number" id="newServiceMinPrice" placeholder="5000">
                </div>
                <div class="form-group">
                    <label>Max Price (₦)</label>
                    <input type="number" id="newServiceMaxPrice" placeholder="15000">
                </div>
            </div>
            <div class="form-group">
                <label>Category *</label>
                <select id="newServiceCategory" required>
                    <option value="">Select category</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="carpentry">Carpentry</option>
                    <option value="painting">Painting</option>
                    <option value="welding">Welding</option>
                    <option value="tailoring">Tailoring</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="newServiceDesc" placeholder="Describe what this service includes..." rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Add Service</button>
        </form>

        <h3 style="margin-top: 2rem;">Your Services</h3>
        <div class="my-services-list">
            ${services && services.length > 0 ? services.map(s => `
                <div class="service-item">
                    <div>
                        <strong>${s.name}</strong> — ${s.category}
                        ${s.price_min ? `<br>₦${Number(s.price_min).toLocaleString()}${s.price_max ? ' - ₦' + Number(s.price_max).toLocaleString() : '+'}` : ''}
                        ${s.description ? `<br><small>${s.description}</small>` : ''}
                    </div>
                    <button class="btn btn-small btn-outline" onclick="deleteService('${s.id}')">Remove</button>
                </div>
            `).join('') : '<p class="no-data">No services added yet.</p>'}
        </div>

        <button onclick="showPage('artisan-dashboard')" class="btn btn-outline" style="margin-top: 1rem;">← Back to Dashboard</button>
    `;
}

async function addService(event) {
    event.preventDefault();
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    try {
        const { error } = await _supabase.from('services').insert([{
            artisan_id: session.user.id,
            name: document.getElementById('newServiceName').value,
            category: document.getElementById('newServiceCategory').value,
            price_min: document.getElementById('newServiceMinPrice').value || null,
            price_max: document.getElementById('newServiceMaxPrice').value || null,
            description: document.getElementById('newServiceDesc').value || null,
        }]);

        if (error) throw error;
        showToast('Service added!', 'success');
        loadArtisanServices();
    } catch (error) {
        showToast('Failed to add service: ' + error.message, 'error');
    }
}

async function deleteService(serviceId) {
    if (!confirm('Remove this service?')) return;
    try {
        const { error } = await _supabase.from('services').delete().eq('id', serviceId);
        if (error) throw error;
        showToast('Service removed.', 'success');
        loadArtisanServices();
    } catch (error) {
        showToast('Failed to remove service.', 'error');
    }
}

// ============================================
// ADMIN DASHBOARD
// ============================================

async function loadAdminDashboard() {
    try {
        const { count: totalUsers } = await _supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: totalArtisans } = await _supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'artisan');
        const { count: totalBookings } = await _supabase.from('bookings').select('*', { count: 'exact', head: true });

        const statsContainer = document.querySelector('#admin-dashboard .admin-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-card"><i class="fas fa-users"></i><h3>${totalUsers || 0}</h3><p>Total Users</p></div>
                <div class="stat-card"><i class="fas fa-tools"></i><h3>${totalArtisans || 0}</h3><p>Artisans</p></div>
                <div class="stat-card"><i class="fas fa-shopping-cart"></i><h3>${totalBookings || 0}</h3><p>Total Bookings</p></div>
            `;
        }

        // Load pending verifications (artisans with 'basic' verification)
        const { data: pendingVerifications } = await _supabase
            .from('profiles')
            .select('*')
            .eq('user_type', 'artisan')
            .eq('verification_level', 'basic')
            .limit(10);

        const verificationList = document.querySelector('#admin-dashboard .verification-list');
        if (verificationList && pendingVerifications) {
            verificationList.innerHTML = pendingVerifications.length > 0
                ? pendingVerifications.map(a => `
                    <div class="verification-item">
                        <div>
                            <h4>${a.full_name}</h4>
                            <p>${a.trade || 'N/A'} • ${a.location || 'N/A'}</p>
                        </div>
                        <div class="verification-actions">
                            <button class="btn btn-small btn-success" onclick="approveVerification('${a.id}')">Approve</button>
                            <button class="btn btn-small btn-outline" onclick="rejectVerification('${a.id}')">Reject</button>
                        </div>
                    </div>
                `).join('')
                : '<p class="no-data">No pending verifications.</p>';
        }

        // Load recent activities
        const { data: recentBookings } = await _supabase
            .from('bookings')
            .select('*, customer:customer_id(full_name), artisan:artisan_id(full_name)')
            .order('created_at', { ascending: false })
            .limit(5);

        const activityList = document.querySelector('#admin-dashboard .activity-list');
        if (activityList && recentBookings) {
            activityList.innerHTML = recentBookings.map(b => `
                <div class="activity">
                    <i class="fas fa-${b.status === 'completed' ? 'check-circle' : b.status === 'pending' ? 'clock' : 'calendar-check'}"></i>
                    <div>
                        <p>${b.service_name}: ${b.customer?.full_name || 'Customer'} → ${b.artisan?.full_name || 'Artisan'} (${b.status})</p>
                        <small>${new Date(b.created_at).toLocaleString()}</small>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Admin dashboard error:', error);
    }
}

async function approveVerification(artisanId) {
    try {
        const { error } = await _supabase
            .from('profiles')
            .update({ verification_level: 'verified' })
            .eq('id', artisanId);

        if (error) throw error;
        showToast('Artisan verification approved!', 'success');
        loadAdminDashboard();
    } catch (error) {
        showToast('Failed to approve verification.', 'error');
    }
}

async function rejectVerification(artisanId) {
    if (!confirm('Reject this verification?')) return;
    showToast('Verification rejected.', 'success');
}

// ============================================
// CONTACT FORM
// ============================================

async function sendContactMessage(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.querySelector('input[type="text"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const message = form.querySelector('textarea').value;

    try {
        const { error } = await _supabase
            .from('contact_messages')
            .insert([{ name, email, message }]);

        if (error) throw error;

        showToast('Message sent! We\'ll respond within 24 hours.', 'success');
        form.reset();
    } catch (error) {
        showToast('Failed to send message. Please try again.', 'error');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    return '<i class="fas fa-star"></i>'.repeat(fullStars)
        + (halfStar ? '<i class="fas fa-star-half-alt"></i>' : '')
        + '<i class="far fa-star"></i>'.repeat(emptyStars);
}

function formatBadge(level) {
    const labels = { 'verified': 'Verified', 'trusted': 'Trusted Artisan', 'top-rated': 'Top Rated' };
    return labels[level] || level;
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateUIForLoggedInUser(profile) {
    document.querySelector('.logged-out').style.display = 'none';
    document.querySelector('.logged-in').style.display = 'block';
    const firstName = profile.full_name ? profile.full_name.split(' ')[0] : 'User';
    const nameSpan = document.querySelector('.user-name');
    if (nameSpan) nameSpan.innerText = `Hi, ${firstName}`;
    const avatar = document.getElementById('userAvatarNav');
    if (avatar) avatar.textContent = firstName.charAt(0).toUpperCase();
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check for existing session
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            localStorage.setItem('userType', profile.user_type);
            localStorage.setItem('userId', profile.id);
            updateUIForLoggedInUser(profile);
        }
    }

    // Load artisans for the Find Artisan page
    loadArtisans();

    // Wire up search/filter events
    const searchBtn = document.querySelector('.search-box .btn');
    if (searchBtn) searchBtn.addEventListener('click', applyFilters);

    const searchInput = document.getElementById('serviceSearch');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    }

    ['categoryFilter', 'locationFilter', 'ratingFilter', 'verificationFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyFilters);
    });
});

// Expose all functions globally
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logout = logout;
window.resetPassword = resetPassword;
window.bookArtisan = bookArtisan;
window.submitBooking = submitBooking;
window.closeBookingModal = closeBookingModal;
window.updateBookingStatus = updateBookingStatus;
window.viewArtisanProfile = viewArtisanProfile;
window.submitReview = submitReview;
window.showReviewModal = showReviewModal;
window.closeReviewModal = closeReviewModal;
window.sendContactMessage = sendContactMessage;
window.loadArtisanServices = loadArtisanServices;
window.addService = addService;
window.deleteService = deleteService;
window.approveVerification = approveVerification;
window.rejectVerification = rejectVerification;
window.applyFilters = applyFilters;
window.goToDashboard = goToDashboard;

function goToDashboard() {
    const userType = localStorage.getItem('userType') || 'customer';
    const userId = localStorage.getItem('userId');
    if (userType === 'admin') {
        showPage('admin-dashboard');
        loadAdminDashboard();
    } else if (userType === 'artisan') {
        showPage('artisan-dashboard');
        if (userId) loadArtisanDashboard(userId);
    } else {
        showPage('customer-dashboard');
        if (userId) loadCustomerDashboard(userId);
    }
}