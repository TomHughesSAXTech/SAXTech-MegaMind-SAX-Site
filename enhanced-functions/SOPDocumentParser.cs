using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace SAXMegaMindDocuments
{
    public class SOPDocumentParser
    {
        // Regex patterns for parsing SOP filenames
        private static readonly Regex DatePattern = new Regex(@"(\d{4})[-_]?(\d{2})[-_]?(\d{2})|(\d{2})[-_]?(\d{2})[-_]?(\d{4})", RegexOptions.Compiled);
        private static readonly Regex DraftPattern = new Regex(@"\b(draft|DRAFT|Draft|wip|WIP)\b", RegexOptions.Compiled);
        private static readonly Regex VersionPattern = new Regex(@"[vV](\d+(?:\.\d+)*)|[Rr]ev(?:ision)?[-_]?(\d+)", RegexOptions.Compiled);
        
        // System name mappings
        private static readonly Dictionary<string, string> SystemMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "hubspot", "HubSpot" },
            { "caseware", "Caseware" },
            { "quickbooks", "QuickBooks" },
            { "qb", "QuickBooks" },
            { "sharepoint", "SharePoint" },
            { "sp", "SharePoint" },
            { "office365", "Office 365" },
            { "o365", "Office 365" },
            { "m365", "Microsoft 365" },
            { "teams", "Microsoft Teams" },
            { "azure", "Azure" },
            { "dynamics", "Dynamics 365" },
            { "salesforce", "Salesforce" },
            { "slack", "Slack" },
            { "zoom", "Zoom" },
            { "docusign", "DocuSign" },
            { "adobe", "Adobe" },
            { "outlook", "Outlook" },
            { "excel", "Excel" },
            { "powerbi", "Power BI" },
            { "onedrive", "OneDrive" },
            { "intuit", "Intuit" },
            { "taxdome", "TaxDome" },
            { "xero", "Xero" },
            { "sage", "Sage" }
        };

        // Procedure type mappings
        private static readonly Dictionary<string, string> ProcedureTypeMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "sop", "Standard Operating Procedure" },
            { "manual", "User Manual" },
            { "guide", "Guidelines" },
            { "guidelines", "Guidelines" },
            { "procedure", "Procedure" },
            { "workflow", "Workflow" },
            { "process", "Process Document" },
            { "instruction", "Instructions" },
            { "training", "Training Material" },
            { "reference", "Reference Guide" },
            { "playbook", "Playbook" },
            { "handbook", "Handbook" },
            { "policy", "Policy Document" },
            { "checklist", "Checklist" }
        };

        // Application area mappings
        private static readonly Dictionary<string, string> ApplicationAreaMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "tax", "Tax & Compliance" },
            { "crm", "Customer Relationship Management" },
            { "hr", "Human Resources" },
            { "finance", "Finance & Accounting" },
            { "accounting", "Finance & Accounting" },
            { "sales", "Sales & Marketing" },
            { "marketing", "Sales & Marketing" },
            { "it", "Information Technology" },
            { "ops", "Operations" },
            { "operations", "Operations" },
            { "admin", "Administration" },
            { "legal", "Legal & Compliance" },
            { "compliance", "Legal & Compliance" },
            { "audit", "Audit & Risk" },
            { "risk", "Audit & Risk" },
            { "payroll", "Payroll" },
            { "billing", "Billing & Invoicing" },
            { "customer", "Customer Service" },
            { "support", "Customer Service" },
            { "procurement", "Procurement" },
            { "project", "Project Management" }
        };

        public static Dictionary<string, object> ParseSOPMetadata(string fileName, string? content = null)
        {
            var metadata = new Dictionary<string, object>();
            
            // Parse system name from filename
            metadata["systemName"] = ExtractSystemName(fileName, content);
            
            // Parse procedure type
            metadata["procedureType"] = ExtractProcedureType(fileName, content);
            
            // Parse effective date
            var effectiveDate = ExtractEffectiveDate(fileName, content);
            if (effectiveDate.HasValue)
            {
                metadata["effectiveDate"] = effectiveDate.Value;
            }
            
            // Check if draft
            metadata["isDraft"] = IsDraft(fileName, content);
            
            // Parse application area
            metadata["applicationArea"] = ExtractApplicationArea(fileName, content);
            
            // Parse compliance type
            metadata["complianceType"] = ExtractComplianceType(fileName, content);
            
            // Parse process category
            metadata["processCategory"] = ExtractProcessCategory(fileName, content);
            
            // Parse target audience
            metadata["targetAudience"] = ExtractTargetAudience(fileName, content);
            
            // Parse related systems
            metadata["relatedSystems"] = ExtractRelatedSystems(fileName, content);
            
            // Parse update frequency
            metadata["updateFrequency"] = ExtractUpdateFrequency(fileName, content);
            
            // Parse version if not already set
            if (!metadata.ContainsKey("version"))
            {
                var version = ExtractVersion(fileName);
                if (!string.IsNullOrEmpty(version))
                {
                    metadata["version"] = version;
                }
            }
            
            return metadata;
        }

        private static string ExtractSystemName(string fileName, string? content)
        {
            // First check filename for system names
            foreach (var system in SystemMappings)
            {
                if (fileName.IndexOf(system.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return system.Value;
                }
            }
            
            // Check content if provided
            if (!string.IsNullOrEmpty(content))
            {
                var contentLower = content.ToLower();
                var systemCounts = new Dictionary<string, int>();
                
                foreach (var system in SystemMappings)
                {
                    var count = Regex.Matches(contentLower, $@"\b{Regex.Escape(system.Key.ToLower())}\b").Count;
                    if (count > 0)
                    {
                        systemCounts[system.Value] = count;
                    }
                }
                
                if (systemCounts.Any())
                {
                    return systemCounts.OrderByDescending(x => x.Value).First().Key;
                }
            }
            
            return "General";
        }

        private static string ExtractProcedureType(string fileName, string? content)
        {
            // Check filename for procedure types
            foreach (var type in ProcedureTypeMappings)
            {
                if (fileName.IndexOf(type.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return type.Value;
                }
            }
            
            // Default to SOP if filename contains common patterns
            if (fileName.ToLower().Contains("procedure") || fileName.ToLower().Contains("process"))
            {
                return "Standard Operating Procedure";
            }
            
            return "Document";
        }

        private static DateTime? ExtractEffectiveDate(string fileName, string? content)
        {
            // Try to extract date from filename
            var match = DatePattern.Match(fileName);
            if (match.Success)
            {
                try
                {
                    if (match.Groups[1].Success)
                    {
                        // Format: YYYY-MM-DD
                        return new DateTime(
                            int.Parse(match.Groups[1].Value),
                            int.Parse(match.Groups[2].Value),
                            int.Parse(match.Groups[3].Value)
                        );
                    }
                    else if (match.Groups[4].Success)
                    {
                        // Format: MM-DD-YYYY
                        return new DateTime(
                            int.Parse(match.Groups[6].Value),
                            int.Parse(match.Groups[4].Value),
                            int.Parse(match.Groups[5].Value)
                        );
                    }
                }
                catch
                {
                    // Invalid date, ignore
                }
            }
            
            // If no date in filename, use current date
            return DateTime.UtcNow;
        }

        private static bool IsDraft(string fileName, string? content)
        {
            // Check filename for draft indicators
            if (DraftPattern.IsMatch(fileName))
            {
                return true;
            }
            
            // Check if filename contains "final" (not a draft)
            if (fileName.IndexOf("final", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return false;
            }
            
            return false;
        }

        private static string ExtractApplicationArea(string fileName, string? content)
        {
            // Check filename for application areas
            foreach (var area in ApplicationAreaMappings)
            {
                if (fileName.IndexOf(area.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return area.Value;
                }
            }
            
            // Check content if provided
            if (!string.IsNullOrEmpty(content))
            {
                var contentLower = content.ToLower();
                foreach (var area in ApplicationAreaMappings)
                {
                    if (contentLower.Contains(area.Key.ToLower()))
                    {
                        return area.Value;
                    }
                }
            }
            
            return "General Operations";
        }

        private static string ExtractComplianceType(string fileName, string? content)
        {
            var complianceKeywords = new Dictionary<string, string>
            {
                { "sox", "SOX Compliance" },
                { "gdpr", "GDPR Compliance" },
                { "hipaa", "HIPAA Compliance" },
                { "pci", "PCI Compliance" },
                { "iso", "ISO Standards" },
                { "audit", "Audit Requirements" },
                { "regulatory", "Regulatory Compliance" },
                { "compliance", "General Compliance" }
            };
            
            foreach (var keyword in complianceKeywords)
            {
                if (fileName.IndexOf(keyword.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return keyword.Value;
                }
            }
            
            if (!string.IsNullOrEmpty(content))
            {
                var contentLower = content.ToLower();
                foreach (var keyword in complianceKeywords)
                {
                    if (contentLower.Contains(keyword.Key))
                    {
                        return keyword.Value;
                    }
                }
            }
            
            return "Standard Practice";
        }

        private static string ExtractProcessCategory(string fileName, string? content)
        {
            var processCategories = new Dictionary<string, string>
            {
                { "setup", "Setup & Configuration" },
                { "config", "Setup & Configuration" },
                { "install", "Setup & Configuration" },
                { "daily", "Daily Operations" },
                { "routine", "Daily Operations" },
                { "monthly", "Periodic Tasks" },
                { "quarterly", "Periodic Tasks" },
                { "annual", "Periodic Tasks" },
                { "yearly", "Periodic Tasks" },
                { "backup", "Maintenance & Support" },
                { "maintenance", "Maintenance & Support" },
                { "troubleshoot", "Troubleshooting" },
                { "error", "Troubleshooting" },
                { "report", "Reporting & Analytics" },
                { "analytics", "Reporting & Analytics" },
                { "integration", "Integration & API" },
                { "api", "Integration & API" },
                { "security", "Security & Access" },
                { "permission", "Security & Access" },
                { "training", "Training & Onboarding" },
                { "onboard", "Training & Onboarding" }
            };
            
            foreach (var category in processCategories)
            {
                if (fileName.IndexOf(category.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return category.Value;
                }
            }
            
            return "Standard Process";
        }

        private static string ExtractTargetAudience(string fileName, string? content)
        {
            var audienceKeywords = new Dictionary<string, string>
            {
                { "admin", "Administrators" },
                { "administrator", "Administrators" },
                { "manager", "Managers" },
                { "staff", "Staff" },
                { "employee", "Employees" },
                { "accountant", "Accounting Team" },
                { "tax", "Tax Professionals" },
                { "it", "IT Department" },
                { "tech", "Technical Staff" },
                { "user", "End Users" },
                { "client", "Client Services" },
                { "customer", "Customer Service" },
                { "executive", "Executives" },
                { "leadership", "Leadership Team" },
                { "partner", "Partners" },
                { "vendor", "Vendors" },
                { "contractor", "Contractors" }
            };
            
            foreach (var keyword in audienceKeywords)
            {
                if (fileName.IndexOf(keyword.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return keyword.Value;
                }
            }
            
            return "All Staff";
        }

        private static List<string> ExtractRelatedSystems(string fileName, string? content)
        {
            var relatedSystems = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            
            // Check filename for all system names
            foreach (var system in SystemMappings)
            {
                if (fileName.IndexOf(system.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    relatedSystems.Add(system.Value);
                }
            }
            
            // Check content for system mentions
            if (!string.IsNullOrEmpty(content))
            {
                var contentLower = content.ToLower();
                foreach (var system in SystemMappings)
                {
                    if (contentLower.Contains(system.Key.ToLower()))
                    {
                        relatedSystems.Add(system.Value);
                    }
                }
            }
            
            return relatedSystems.ToList();
        }

        private static string ExtractUpdateFrequency(string fileName, string? content)
        {
            var frequencyKeywords = new Dictionary<string, string>
            {
                { "daily", "Daily" },
                { "weekly", "Weekly" },
                { "monthly", "Monthly" },
                { "quarterly", "Quarterly" },
                { "annual", "Annually" },
                { "yearly", "Annually" },
                { "biannual", "Bi-Annually" },
                { "semiannual", "Semi-Annually" }
            };
            
            foreach (var keyword in frequencyKeywords)
            {
                if (fileName.IndexOf(keyword.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return keyword.Value;
                }
            }
            
            // Check content for review/update frequency mentions
            if (!string.IsNullOrEmpty(content))
            {
                var reviewPattern = new Regex(@"review(?:ed)?\s+(\w+ly)", RegexOptions.IgnoreCase);
                var match = reviewPattern.Match(content);
                if (match.Success)
                {
                    var frequency = match.Groups[1].Value.ToLower();
                    if (frequencyKeywords.ContainsKey(frequency.Replace("ly", "")))
                    {
                        return frequencyKeywords[frequency.Replace("ly", "")];
                    }
                }
            }
            
            return "As Needed";
        }

        private static string ExtractVersion(string fileName)
        {
            var match = VersionPattern.Match(fileName);
            if (match.Success)
            {
                if (match.Groups[1].Success)
                {
                    return $"v{match.Groups[1].Value}";
                }
                else if (match.Groups[2].Success)
                {
                    return $"Rev {match.Groups[2].Value}";
                }
            }
            
            return "1.0";
        }
    }
}
