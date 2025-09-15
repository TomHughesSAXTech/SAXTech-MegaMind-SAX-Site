# AI Agent Prompt Template with Enhanced User Data Formatting

## System Prompt Structure

```
You are a helpful AI assistant for SAX Advisory Group. When providing employee information, format it clearly and professionally.

### Response Formatting Guidelines:

1. **For Single Employee Results:**
   - Present information in a conversational, easy-to-read format
   - Include profile photo if available using the provided base64 data
   - Highlight key contact information
   - Make email addresses and phone numbers clickable

2. **For Multiple Employee Results:**
   - Show up to 5 detailed cards, summarize the rest
   - Group by department or role when relevant
   - Provide quick contact links

3. **Profile Photo Handling:**
   - Photos are provided as base64 data URLs
   - Display them as circular thumbnails (100x100px)
   - Use this format: <img src="${profilePhoto}" style="width:100px;height:100px;border-radius:50%;" />

### Employee Data Context:
${entraData}

### User Query:
${userQuery}
```

## Enhanced HTML Template for Employee Cards

```html
<div class="employee-result" style="max-width: 600px; margin: 0 auto;">
    <!-- Single Employee Card -->
    <div class="employee-card" style="
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 20px;
        margin: 15px 0;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    ">
        <!-- Header with Photo -->
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            ${profilePhoto ? `
            <img src="${profilePhoto}" 
                 alt="${displayName}" 
                 style="
                     width: 80px;
                     height: 80px;
                     border-radius: 50%;
                     object-fit: cover;
                     border: 3px solid #fff;
                     box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                     margin-right: 15px;
                 " />
            ` : `
            <div style="
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: #667eea;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 32px;
                font-weight: bold;
                margin-right: 15px;
            ">${initials}</div>
            `}
            
            <div>
                <h3 style="margin: 0; color: #2d3748; font-size: 20px;">
                    ${displayName}
                </h3>
                <p style="margin: 5px 0; color: #4a5568; font-size: 14px;">
                    ${jobTitle}
                </p>
            </div>
        </div>
        
        <!-- Contact Info Grid -->
        <div style="
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px;
            font-size: 14px;
        ">
            <span style="color: #718096; font-weight: 500;">📧 Email:</span>
            <a href="mailto:${email}" style="color: #4299e1; text-decoration: none;">
                ${email}
            </a>
            
            ${phone ? `
            <span style="color: #718096; font-weight: 500;">📞 Phone:</span>
            <a href="tel:${phone}" style="color: #4299e1; text-decoration: none;">
                ${phone}
            </a>
            ` : ''}
            
            ${mobile ? `
            <span style="color: #718096; font-weight: 500;">📱 Mobile:</span>
            <a href="tel:${mobile}" style="color: #4299e1; text-decoration: none;">
                ${mobile}
            </a>
            ` : ''}
            
            <span style="color: #718096; font-weight: 500;">🏢 Department:</span>
            <span style="color: #2d3748;">${department}</span>
            
            <span style="color: #718096; font-weight: 500;">📍 Location:</span>
            <span style="color: #2d3748;">${location}</span>
            
            ${manager ? `
            <span style="color: #718096; font-weight: 500;">👔 Manager:</span>
            <span style="color: #2d3748;">
                ${managerEmail ? 
                    `<a href="mailto:${managerEmail}" style="color: #4299e1; text-decoration: none;">${manager}</a>` : 
                    manager
                }
            </span>
            ` : ''}
        </div>
        
        <!-- Quick Actions -->
        <div style="
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(0,0,0,0.1);
            display: flex;
            gap: 10px;
        ">
            <a href="mailto:${email}" style="
                padding: 8px 16px;
                background: #4299e1;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
            ">Send Email</a>
            
            ${mobile ? `
            <a href="tel:${mobile}" style="
                padding: 8px 16px;
                background: #48bb78;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
            ">Call Mobile</a>
            ` : ''}
        </div>
    </div>
</div>
```

## Simplified Text Format for AI Prompt

```
EMPLOYEE INFORMATION:
Name: [Full Name]
Title: [Job Title]
Department: [Department]
Email: [Email Address]
Phone: [Business Phone]
Mobile: [Mobile Phone]
Location: [Office Location]
Manager: [Manager Name]
Has Photo: [Yes/No]

When presenting this information:
1. Be conversational and helpful
2. Highlight the most relevant details for the user's query
3. Provide actionable next steps (e.g., "Would you like me to draft an email to them?")
4. If multiple people found, offer to narrow down the search
```

## N8N Workflow Integration

### 1. After Entra Search Node
Add the formatting node (`n8n-entra-format-enhanced.js`) to process raw Entra data

### 2. In AI Agent Prompt
Use the formatted outputs:
- `formattedPrompt` - Clean text for AI understanding
- `htmlOutput` - Pre-formatted HTML for display
- `textOutput` - Fallback text format

### 3. Example AI Agent Configuration

```javascript
// In your AI agent prompt node
const entraData = $json.formattedPrompt || $json.textOutput || 'No employee data available';
const hasPhotos = $json.hasPhotos || false;
const userCount = $json.userCount || 0;

const systemPrompt = `
You are the SAX Advisory Group AI Assistant. 

${userCount > 0 ? `
I have found ${userCount} employee(s) matching the search.
${hasPhotos ? 'Profile photos are available for display.' : ''}

Employee Data:
${entraData}

Instructions:
- Present this information clearly and professionally
- Use the HTML formatting when available
- Make contact information actionable (clickable)
- Offer relevant follow-up actions
` : 'Help the user search for employees in our directory.'}
`;

return systemPrompt;
```

## Tips for Better Formatting

1. **Profile Photos**
   - Already base64 encoded from Entra
   - Can be directly embedded in `<img>` tags
   - No additional processing needed
   - Use fallback initials if no photo

2. **Contact Links**
   - Always use `mailto:` for emails
   - Use `tel:` for phone numbers
   - Make them stand out visually

3. **Responsive Design**
   - Use inline styles for email compatibility
   - Keep cards under 600px wide
   - Use grid/flexbox for alignment

4. **Performance**
   - Limit detailed cards to 5 employees
   - Summarize additional results
   - Cache photos when possible

5. **Accessibility**
   - Include alt text for images
   - Use semantic HTML
   - Ensure sufficient color contrast