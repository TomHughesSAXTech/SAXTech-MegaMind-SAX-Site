// N8N Code Node - Enhanced Entra User Formatting for Chatbot
// This node formats Entra ID user data into a clean HTML format for the chatbot prompt

// Get the Entra search results from previous node
const entraResults = $json;

// Parse results if they're a string
let data;
if (typeof entraResults === 'string') {
    data = JSON.parse(entraResults);
} else {
    data = entraResults;
}

// Check if we have users to format
if (!data.success || !data.users || data.users.length === 0) {
    return [{
        json: {
            formattedPrompt: data.message || 'No users found',
            hasUsers: false,
            ...data
        }
    }];
}

// Helper function to format a single user as HTML card
function formatUserCard(user) {
    // Build the HTML card with inline styles for better rendering
    let html = `
<div class="employee-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f9f9f9;">
    <h4 style="margin: 0 0 10px 0; color: #333;">👤 ${user.displayName}</h4>`;
    
    // Add profile photo if available
    if (user.profilePhoto) {
        html += `
    <div style="margin: 10px 0;">
        <img src="${user.profilePhoto}" alt="${user.displayName}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 2px solid #ddd;" />
    </div>`;
    }
    
    // Add user details in a clean table format
    html += `
    <table class="employee-info" style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 5px; font-weight: bold; width: 30%;">Title:</td><td style="padding: 5px;">${user.jobTitle}</td></tr>
        <tr><td style="padding: 5px; font-weight: bold;">Department:</td><td style="padding: 5px;">${user.department}</td></tr>
        <tr><td style="padding: 5px; font-weight: bold;">Company:</td><td style="padding: 5px;">${user.company}</td></tr>
        <tr><td style="padding: 5px; font-weight: bold;">Email:</td><td style="padding: 5px;"><a href="mailto:${user.email}" style="color: #0066cc;">${user.email}</a></td></tr>`;
    
    // Add phone if available
    if (user.phone && user.phone !== 'Not available') {
        html += `
        <tr><td style="padding: 5px; font-weight: bold;">Phone:</td><td style="padding: 5px;"><a href="tel:${user.phone}" style="color: #0066cc;">${user.phone}</a></td></tr>`;
    }
    
    // Add mobile if available
    if (user.mobile && user.mobile !== 'Not available') {
        html += `
        <tr><td style="padding: 5px; font-weight: bold;">Mobile:</td><td style="padding: 5px;"><a href="tel:${user.mobile}" style="color: #0066cc;">${user.mobile}</a></td></tr>`;
    }
    
    // Add location
    html += `
        <tr><td style="padding: 5px; font-weight: bold;">Location:</td><td style="padding: 5px;">${user.location}</td></tr>`;
    
    // Add manager if available
    if (user.manager && user.manager !== 'Not specified') {
        html += `
        <tr><td style="padding: 5px; font-weight: bold;">Manager:</td><td style="padding: 5px;">`;
        
        if (user.managerEmail) {
            html += `<a href="mailto:${user.managerEmail}" style="color: #0066cc;">${user.manager}</a>`;
        } else {
            html += user.manager;
        }
        
        html += `</td></tr>`;
    }
    
    // Add start date if available
    if (user.startDate && user.startDate !== 'Not available') {
        html += `
        <tr><td style="padding: 5px; font-weight: bold;">Start Date:</td><td style="padding: 5px;">${user.startDate}</td></tr>`;
    }
    
    html += `
    </table>
</div>`;
    
    return html;
}

// Helper function to format user as structured text (fallback)
function formatUserText(user) {
    let text = `**${user.displayName}**\n`;
    text += `• Title: ${user.jobTitle}\n`;
    text += `• Department: ${user.department}\n`;
    text += `• Company: ${user.company}\n`;
    text += `• Email: ${user.email}\n`;
    
    if (user.phone && user.phone !== 'Not available') {
        text += `• Phone: ${user.phone}\n`;
    }
    
    if (user.mobile && user.mobile !== 'Not available') {
        text += `• Mobile: ${user.mobile}\n`;
    }
    
    text += `• Location: ${user.location}\n`;
    
    if (user.manager && user.manager !== 'Not specified') {
        text += `• Manager: ${user.manager}`;
        if (user.managerEmail) {
            text += ` (${user.managerEmail})`;
        }
        text += '\n';
    }
    
    if (user.startDate && user.startDate !== 'Not available') {
        text += `• Start Date: ${user.startDate}\n`;
    }
    
    if (user.profilePhoto) {
        text += `• [Profile photo available]\n`;
    }
    
    return text;
}

// Format the prompt based on number of users
let formattedPrompt = '';
let htmlOutput = '';
let textOutput = '';

if (data.users.length === 1) {
    // Single user - detailed view
    const user = data.users[0];
    
    // HTML version
    htmlOutput = formatUserCard(user);
    
    // Text version
    textOutput = `I found the following employee information:\n\n${formatUserText(user)}`;
    
    // Combined prompt for AI
    formattedPrompt = `User Information Found:
    
Name: ${user.displayName}
Title: ${user.jobTitle}
Department: ${user.department}
Company: ${user.company}
Email: ${user.email}
Phone: ${user.phone}
Mobile: ${user.mobile}
Location: ${user.location}
Manager: ${user.manager}${user.managerEmail ? ` (${user.managerEmail})` : ''}
Start Date: ${user.startDate}
Has Profile Photo: ${user.profilePhoto ? 'Yes' : 'No'}

Please provide this information in a helpful and conversational way.`;

} else {
    // Multiple users - list view
    htmlOutput = `
<div style="font-family: Arial, sans-serif;">
    <p style="margin-bottom: 15px;">Found ${data.users.length} employees matching your search:</p>`;
    
    textOutput = `I found ${data.users.length} employees:\n\n`;
    
    // Create both HTML and text versions
    data.users.forEach((user, index) => {
        if (index < 5) { // Limit HTML cards to first 5 for performance
            htmlOutput += formatUserCard(user);
        } else if (index === 5) {
            htmlOutput += `<p style="margin: 15px 0; font-style: italic;">...and ${data.users.length - 5} more employees.</p>`;
        }
        
        textOutput += formatUserText(user) + '\n';
    });
    
    htmlOutput += `</div>`;
    
    // Summary for AI prompt
    const userSummary = data.users.slice(0, 10).map(u => 
        `- ${u.displayName} (${u.jobTitle}, ${u.department})`
    ).join('\n');
    
    formattedPrompt = `Found ${data.users.length} employees matching the search:

${userSummary}${data.users.length > 10 ? `\n...and ${data.users.length - 10} more` : ''}

Please present this information in a helpful way, highlighting the most relevant details for the user's query: "${data.query}"`;
}

// Prepare the output
const output = {
    // Original data
    ...data,
    
    // Formatted outputs
    formattedPrompt: formattedPrompt,
    htmlOutput: htmlOutput,
    textOutput: textOutput,
    
    // Metadata
    hasUsers: true,
    userCount: data.users.length,
    hasPhotos: data.users.some(u => u.profilePhoto !== null),
    
    // Enhanced user data with proper photo handling
    enhancedUsers: data.users.map(user => ({
        ...user,
        // Ensure photo is properly formatted
        profilePhotoHtml: user.profilePhoto ? 
            `<img src="${user.profilePhoto}" alt="${user.displayName}" style="width: 100px; height: 100px; border-radius: 50%;" />` : 
            null,
        // Create a display-ready format
        displayFormat: {
            name: user.displayName,
            title: user.jobTitle,
            contactHtml: `<a href="mailto:${user.email}">${user.email}</a>`,
            photoAvailable: !!user.profilePhoto
        }
    }))
};

// Return the formatted data
return [{ json: output }];