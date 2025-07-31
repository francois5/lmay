/**
 * Frontend JavaScript for the demo
 */

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.success) {
            displayUsers(data.data);
        } else {
            console.error('Failed to load users:', data.error);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(users) {
    const usersList = document.getElementById('users-list');
    
    if (users.length === 0) {
        usersList.innerHTML = '<p>No users found.</p>';
        return;
    }
    
    const html = users.map(user => `
        <div class="user-item">
            <strong>${user.name}</strong> - ${user.email}
        </div>
    `).join('');
    
    usersList.innerHTML = html;
}

// Load users on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Basic project frontend loaded');
});