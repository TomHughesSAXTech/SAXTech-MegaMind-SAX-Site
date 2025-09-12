/**
 * Enhanced Document Icons and Display
 * Provides realistic file type icons and better title formatting
 */

(function() {
    'use strict';

    // SVG icons for different file types - realistic representations
    const FILE_ICONS = {
        pdf: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#DC2626"/>
                <path d="M8 22V10H10.5C11.5 10 12 10.5 12 11.5C12 12.5 11.5 13 10.5 13H9V14.5H10.5C11.5 14.5 12 15 12 16C12 17 11.5 17.5 10.5 17.5H9V22H8Z" fill="white"/>
                <path d="M13 22V10H15C17 10 18 11 18 13V19C18 21 17 22 15 22H13ZM14 21H15C16.5 21 17 20.5 17 19V13C17 11.5 16.5 11 15 11H14V21Z" fill="white"/>
                <path d="M19 22V10H23V11H20V15H22V16H20V22H19Z" fill="white"/>
            </svg>`,
            color: '#DC2626',
            gradient: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)'
        },
        word: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#2563EB"/>
                <path d="M8 10H10L11.5 18L13 10H15L13 22H11L10 16L9 22H7L5 10H7L8.5 18L10 10H8Z" fill="white" opacity="0.9"/>
                <rect x="17" y="10" width="10" height="1" fill="white" opacity="0.5"/>
                <rect x="17" y="13" width="10" height="1" fill="white" opacity="0.5"/>
                <rect x="17" y="16" width="8" height="1" fill="white" opacity="0.5"/>
                <rect x="17" y="19" width="10" height="1" fill="white" opacity="0.5"/>
            </svg>`,
            color: '#2563EB',
            gradient: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
        },
        excel: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#059669"/>
                <path d="M7 10H10L12 16L14 10H17L13.5 18L17 26H14L12 20L10 26H7L10.5 18L7 10Z" fill="white"/>
                <rect x="19" y="9" width="6" height="4" stroke="white" stroke-width="0.5" fill="none"/>
                <rect x="19" y="14" width="6" height="4" stroke="white" stroke-width="0.5" fill="none"/>
                <rect x="19" y="19" width="6" height="4" stroke="white" stroke-width="0.5" fill="none"/>
            </svg>`,
            color: '#059669',
            gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
        },
        powerpoint: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#EA580C"/>
                <path d="M8 22V10H12C14 10 15 11 15 13C15 15 14 16 12 16H9V22H8ZM9 15H12C13 15 14 14.5 14 13C14 11.5 13 11 12 11H9V15Z" fill="white"/>
                <rect x="17" y="12" width="8" height="8" rx="1" stroke="white" stroke-width="1" fill="none"/>
                <circle cx="19" cy="14" r="0.5" fill="white"/>
                <circle cx="23" cy="14" r="0.5" fill="white"/>
                <rect x="18" y="16" width="6" height="0.5" fill="white"/>
                <rect x="18" y="18" width="6" height="0.5" fill="white"/>
            </svg>`,
            color: '#EA580C',
            gradient: 'linear-gradient(135deg, #EA580C 0%, #DC2626 100%)'
        },
        text: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#6B7280"/>
                <rect x="8" y="9" width="16" height="1" fill="white" opacity="0.8"/>
                <rect x="8" y="12" width="14" height="1" fill="white" opacity="0.8"/>
                <rect x="8" y="15" width="16" height="1" fill="white" opacity="0.8"/>
                <rect x="8" y="18" width="12" height="1" fill="white" opacity="0.8"/>
                <rect x="8" y="21" width="15" height="1" fill="white" opacity="0.8"/>
            </svg>`,
            color: '#6B7280',
            gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)'
        },
        csv: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#10B981"/>
                <rect x="7" y="9" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="12" y="9" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="17" y="9" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="22" y="9" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="7" y="13" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="12" y="13" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="17" y="13" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="22" y="13" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="7" y="17" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="12" y="17" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="17" y="17" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="22" y="17" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="7" y="21" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="12" y="21" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="17" y="21" width="4" height="3" stroke="white" stroke-width="0.5"/>
                <rect x="22" y="21" width="4" height="3" stroke="white" stroke-width="0.5"/>
            </svg>`,
            color: '#10B981',
            gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
        },
        default: {
            svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="4" fill="#9CA3AF"/>
                <path d="M9 8V24H23V11L20 8H9Z" stroke="white" stroke-width="1" fill="none"/>
                <path d="M20 8V11H23" stroke="white" stroke-width="1" fill="none"/>
            </svg>`,
            color: '#9CA3AF',
            gradient: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)'
        }
    };

    // Get file type icon info
    window.getFileTypeIcon = function(fileName) {
        if (!fileName) return FILE_ICONS.default;
        
        const ext = fileName.split('.').pop().toLowerCase();
        
        const iconMap = {
            'pdf': FILE_ICONS.pdf,
            'doc': FILE_ICONS.word,
            'docx': FILE_ICONS.word,
            'xls': FILE_ICONS.excel,
            'xlsx': FILE_ICONS.excel,
            'ppt': FILE_ICONS.powerpoint,
            'pptx': FILE_ICONS.powerpoint,
            'txt': FILE_ICONS.text,
            'csv': FILE_ICONS.csv
        };
        
        return iconMap[ext] || FILE_ICONS.default;
    };

    // Enhanced document card creation
    window.createEnhancedDocumentCard = function(doc) {
        const fileName = doc.fileName || doc.title || 'Untitled Document';
        const fileIcon = getFileTypeIcon(fileName);
        const title = doc.title || fileName;
        
        const card = document.createElement('div');
        card.className = 'document-card-enhanced';
        card.style.cssText = `
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 16px;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            transition: all 0.2s ease;
            align-items: start;
            margin-bottom: 12px;
        `;
        
        // Icon container
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: ${fileIcon.gradient};
            position: relative;
        `;
        iconContainer.innerHTML = fileIcon.svg;
        
        // Add indexed badge if applicable
        if (doc.indexed) {
            const badge = document.createElement('div');
            badge.style.cssText = `
                position: absolute;
                top: -4px;
                right: -4px;
                width: 16px;
                height: 16px;
                background: #10b981;
                border: 2px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                font-weight: bold;
            `;
            badge.innerHTML = '✓';
            iconContainer.appendChild(badge);
        }
        
        // Info container with proper title handling
        const infoContainer = document.createElement('div');
        infoContainer.style.cssText = `
            min-width: 0;
            flex: 1;
        `;
        
        // Title - Allow wrapping for long titles
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            font-weight: 600;
            color: #1e293b;
            font-size: 14px;
            line-height: 1.4;
            margin-bottom: 4px;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        `;
        titleDiv.textContent = title;
        titleDiv.title = title; // Full title on hover
        
        // File name if different from title
        const fileNameDiv = document.createElement('div');
        if (doc.title && doc.fileName && doc.title !== doc.fileName) {
            fileNameDiv.style.cssText = `
                font-size: 11px;
                color: #64748b;
                margin-bottom: 4px;
            `;
            fileNameDiv.innerHTML = `<strong>File:</strong> ${doc.fileName}`;
        }
        
        // Metadata
        const metaDiv = document.createElement('div');
        metaDiv.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 11px;
            color: #64748b;
            margin-bottom: 6px;
        `;
        
        const metaItems = [];
        if (doc.uploadDate || doc.lastModified) {
            const date = new Date(doc.uploadDate || doc.lastModified).toLocaleDateString();
            metaItems.push(`<span>📅 ${date}</span>`);
        }
        if (doc.fileSize) {
            metaItems.push(`<span>💾 ${formatFileSize(doc.fileSize)}</span>`);
        }
        if (doc.department) {
            metaItems.push(`<span>🏢 ${doc.department}</span>`);
        }
        metaDiv.innerHTML = metaItems.join('');
        
        // Description
        if (doc.description) {
            const descDiv = document.createElement('div');
            descDiv.style.cssText = `
                font-size: 12px;
                color: #94a3b8;
                line-height: 1.4;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            `;
            descDiv.textContent = doc.description;
            infoContainer.appendChild(descDiv);
        }
        
        // Build info container
        infoContainer.appendChild(titleDiv);
        if (fileNameDiv.innerHTML) infoContainer.appendChild(fileNameDiv);
        infoContainer.appendChild(metaDiv);
        
        // Actions container
        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;
        
        // Preview button
        const previewBtn = document.createElement('button');
        previewBtn.className = 'action-btn';
        previewBtn.style.cssText = `
            padding: 6px 12px;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s;
        `;
        previewBtn.innerHTML = '<span>👁️</span> Preview';
        previewBtn.onclick = () => window.previewDocument(doc.id, doc.fileName || doc.title, null, null, null, doc.department);
        
        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'action-btn';
        downloadBtn.style.cssText = previewBtn.style.cssText;
        downloadBtn.innerHTML = '<span>⬇️</span> Download';
        downloadBtn.onclick = () => window.downloadDocument(doc.id, doc.fileName || doc.title, doc.department);
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.style.cssText = `
            width: 32px;
            height: 32px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            cursor: pointer;
            color: #dc2626;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete document';
        deleteBtn.onclick = () => window.deleteDocument(doc.id, doc.title || doc.fileName);
        
        actionsContainer.appendChild(previewBtn);
        actionsContainer.appendChild(downloadBtn);
        actionsContainer.appendChild(deleteBtn);
        
        // Assemble card
        card.appendChild(iconContainer);
        card.appendChild(infoContainer);
        card.appendChild(actionsContainer);
        
        // Hover effect
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#3b82f6';
            card.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e5e7eb';
            card.style.boxShadow = 'none';
        });
        
        return card;
    };
    
    // Helper function for file size formatting
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }
})();
