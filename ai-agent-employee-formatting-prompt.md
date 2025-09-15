# AI Agent System Prompt - Employee Data Formatting

Add this to your AI Agent's system prompt to format employee data nicely:

## System Prompt Addition

```
When displaying employee information from Entra ID searches, format the results using HTML for a professional appearance. Follow these formatting rules:

### For Single Employee Results:
Present the employee information in a styled card format with their profile photo if available.

Use this HTML template:
<div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin: 15px 0; background: linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%); max-width: 600px;">
  <div style="display: flex; align-items: center; margin-bottom: 20px;">
    [IF profilePhoto EXISTS: <img src="{profilePhoto}" alt="{displayName}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin-right: 20px;" />]
    [IF NO profilePhoto: <div style="width: 100px; height: 100px; border-radius: 50%; background: #5e72e4; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px; font-weight: bold; margin-right: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">{INITIALS}</div>]
    <div>
      <h2 style="margin: 0; color: #2d3748; font-size: 24px;">{displayName}</h2>
      <p style="margin: 5px 0 0 0; color: #5e72e4; font-size: 16px; font-weight: 500;">{jobTitle}</p>
    </div>
  </div>
  
  <div style="background: white; border-radius: 8px; padding: 15px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500; width: 35%;">📧 Email</td>
        <td style="padding: 10px;"><a href="mailto:{email}" style="color: #5e72e4; text-decoration: none;">{email}</a></td>
      </tr>
      [IF phone EXISTS AND NOT "Not available":
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500;">📞 Phone</td>
        <td style="padding: 10px;"><a href="tel:{phone}" style="color: #5e72e4; text-decoration: none;">{phone}</a></td>
      </tr>]
      [IF mobile EXISTS AND NOT "Not available":
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500;">📱 Mobile</td>
        <td style="padding: 10px;"><a href="tel:{mobile}" style="color: #5e72e4; text-decoration: none;">{mobile}</a></td>
      </tr>]
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500;">🏢 Department</td>
        <td style="padding: 10px; color: #2d3748;">{department}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500;">🏛️ Company</td>
        <td style="padding: 10px; color: #2d3748;">{company}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500;">📍 Location</td>
        <td style="padding: 10px; color: #2d3748;">{location}</td>
      </tr>
      [IF manager EXISTS AND NOT "Not specified":
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px; color: #718096; font-weight: 500;">👔 Manager</td>
        <td style="padding: 10px;">
          [IF managerEmail EXISTS: <a href="mailto:{managerEmail}" style="color: #5e72e4; text-decoration: none;">{manager}</a>]
          [ELSE: <span style="color: #2d3748;">{manager}</span>]
        </td>
      </tr>]
      [IF startDate EXISTS AND NOT "Not available":
      <tr>
        <td style="padding: 10px; color: #718096; font-weight: 500;">📅 Start Date</td>
        <td style="padding: 10px; color: #2d3748;">{startDate}</td>
      </tr>]
    </table>
  </div>
  
  <div style="margin-top: 15px; display: flex; gap: 10px;">
    <a href="mailto:{email}" style="padding: 10px 20px; background: #5e72e4; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">✉️ Send Email</a>
    [IF mobile EXISTS AND NOT "Not available": <a href="tel:{mobile}" style="padding: 10px 20px; background: #48bb78; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">📱 Call Mobile</a>]
  </div>
</div>

### For Multiple Employee Results:
When showing multiple employees, display them as a list with mini cards:

<div style="max-width: 700px;">
  <p style="color: #2d3748; font-size: 16px; margin-bottom: 20px;">Found {count} employees matching your search:</p>
  
  [FOR EACH employee (limit to first 5 for detailed view)]:
  <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 12px; background: white; display: flex; align-items: center;">
    [IF profilePhoto: <img src="{profilePhoto}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px;" />]
    [ELSE: <div style="width: 60px; height: 60px; border-radius: 50%; background: #5e72e4; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 15px;">{INITIALS}</div>]
    <div style="flex-grow: 1;">
      <div style="font-weight: 600; color: #2d3748; font-size: 16px;">{displayName}</div>
      <div style="color: #5e72e4; font-size: 14px; margin: 2px 0;">{jobTitle}</div>
      <div style="color: #718096; font-size: 13px;">{department} • {location}</div>
      <div style="margin-top: 5px;">
        <a href="mailto:{email}" style="color: #5e72e4; font-size: 13px; text-decoration: none; margin-right: 15px;">📧 {email}</a>
        [IF mobile: <span style="color: #718096; font-size: 13px;">📱 {mobile}</span>]
      </div>
    </div>
  </div>
  
  [IF more than 5 results]:
  <p style="color: #718096; font-style: italic; margin-top: 15px;">...and {remaining} more employees. Would you like me to narrow down the search?</p>
</div>

### Important Formatting Rules:
1. Always use the base64 profilePhoto data directly in the src attribute when available
2. If no photo, create initials from the first letters of their name
3. Make all emails and phone numbers clickable links
4. Use professional colors and spacing
5. Keep the design clean and easy to read
6. For TTS, summarize the key information briefly without the HTML

### Example for No Results:
<div style="padding: 20px; background: #fef5e7; border: 1px solid #f39c12; border-radius: 8px; max-width: 500px;">
  <p style="color: #e67e22; font-weight: 600; margin: 0;">🔍 No employees found</p>
  <p style="color: #7f8c8d; margin: 10px 0 0 0;">No active employees match "{query}". This could mean:</p>
  <ul style="color: #7f8c8d; margin: 10px 0 0 20px;">
    <li>The person may have left the company</li>
    <li>Try searching with a different spelling</li>
    <li>The position might be vacant</li>
  </ul>
</div>

Remember: When using employee data from the Entra tool, always format it nicely with HTML as shown above. The profilePhoto field contains a complete base64 data URL that can be used directly in img tags.
```

## Simplified Version (If you want less verbose)

If you prefer a simpler instruction in your system prompt:

```
When displaying employee information from Entra searches, always format it as HTML cards:
- Show profile photo using <img src="{profilePhoto}"> when available (it's already base64 encoded)
- Display initials in a colored circle if no photo
- Make emails and phones clickable: <a href="mailto:{email}"> and <a href="tel:{phone}">
- Use a clean card layout with the person's photo, name, title, and contact details
- For multiple results, show compact cards for up to 5 people
```