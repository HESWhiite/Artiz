// Replace with your Supabase Project details
const SUPABASE_URL = 'https://kwtcjrcouakkzevvulxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dGNqcmNvdWFra3pldnZ1bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDEzODgsImV4cCI6MjA4NTE3NzM4OH0.no2HsSeNj_p2l91aQQvf5H6giT9WwxBbWDJlAM2HBPs';

// FIX: Initialize the client correctly using the global 'supabase' object provided by the CDN
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- AUTHENTICATION ---

async function registerUser(event, userType) {
    event.preventDefault();
    
    const email = userType === 'customer' ? document.getElementById('custEmail').value : document.getElementById('artEmail').value;
    const password = userType === 'customer' ? document.getElementById('custPassword').value : document.getElementById('artPassword').value;
    const fullName = userType === 'customer' ? document.getElementById('custName').value : document.getElementById('artName').value;
    const phone = userType === 'customer' ? document.getElementById('custPhone').value : document.getElementById('artPhone').value;

    try {
        const { data: authData, error: authError } = await _supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;

        const { error: profileError } = await _supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                full_name: fullName,
                phone_number: phone,
                user_type: userType,
                location: userType === 'customer' ? document.getElementById('custLocation').value : null,
                trade: userType === 'artisan' ? document.getElementById('artTrade').value : null,
                experience: userType === 'artisan' ? document.getElementById('artExperience').value : null
            }]);

        if (profileError) throw profileError;

        alert('Registration successful! Please login.');
        showPage('login');
    } catch (error) {
        alert(error.message);
    }
}

async function loginUser(event) {
    event.preventDefault();
    const email = document.getElementById('loginPhone').value; 
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        localStorage.setItem('userType', profile.user_type);
        updateUIForLoggedInUser(profile);
        showPage(`${profile.user_type}-dashboard`);
    } catch (error) {
        alert(error.message);
    }
}

async function logout() {
    await _supabase.auth.signOut();
    document.querySelector('.logged-out').style.display = 'flex';
    document.querySelector('.logged-in').style.display = 'none';
    showPage('landing');
}

// --- DATA FETCHING ---

async function loadArtisans() {
    const { data, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'artisan');

    if (error) console.error(error);
    renderArtisanCards(data);
}

function renderArtisanCards(artisans) {
    const grid = document.querySelector('.artisans-grid');
    if (!grid) return; // Stop if the grid doesn't exist on the current page

    // Check if artisans is actually an array with data
    if (Array.isArray(artisans) && artisans.length > 0) {
        grid.innerHTML = artisans.map(artisan => `
            <div class="artisan-card">
                <div class="artisan-header">
                    <div class="artisan-avatar">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.full_name)}" alt="Artisan">
                    </div>
                    <div class="artisan-info">
                        <h3>${artisan.full_name}</h3>
                        <p class="trade">${artisan.trade || 'General Artisan'}</p>
                        <div class="rating"><span>⭐ ${artisan.rating || 'N/A'}</span></div>
                    </div>
                </div>
                <div class="artisan-actions">
                    <button class="btn btn-primary" onclick="bookArtisan('${artisan.id}')">Book Now</button>
                </div>
            </div>
        `).join('');
    } else {
        // Show a friendly message if the list is empty
        grid.innerHTML = '<p class="no-data">No artisans found yet. Be the first to join!</p>';
    }
}

// --- INITIALIZATION ---
function updateUIForLoggedInUser(profile) {
    document.querySelector('.logged-out').style.display = 'none';
    document.querySelector('.logged-in').style.display = 'block';
    const nameSpan = document.querySelector('.user-name');
    if (nameSpan) nameSpan.innerText = `Hi, ${profile.full_name.split(' ')[0]}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: profile } = await _supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile) updateUIForLoggedInUser(profile);
    }
    loadArtisans();
});

// Expose functions to the HTML window
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logout = logout;