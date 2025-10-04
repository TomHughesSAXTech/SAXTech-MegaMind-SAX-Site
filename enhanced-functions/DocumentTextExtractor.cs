using System;
using System.IO;
using System.Text;
using System.Linq;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Presentation;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;
using Microsoft.Extensions.Logging;
using Paragraph = DocumentFormat.OpenXml.Wordprocessing.Paragraph;
using Table = DocumentFormat.OpenXml.Wordprocessing.Table;
using TableRow = DocumentFormat.OpenXml.Wordprocessing.TableRow;
using TableCell = DocumentFormat.OpenXml.Wordprocessing.TableCell;
using Cell = DocumentFormat.OpenXml.Spreadsheet.Cell;
using Row = DocumentFormat.OpenXml.Spreadsheet.Row;
using Sheet = DocumentFormat.OpenXml.Spreadsheet.Sheet;
using SheetData = DocumentFormat.OpenXml.Spreadsheet.SheetData;
using CellValues = DocumentFormat.OpenXml.Spreadsheet.CellValues;
using WorksheetPart = DocumentFormat.OpenXml.Packaging.WorksheetPart;
using SharedStringTablePart = DocumentFormat.OpenXml.Packaging.SharedStringTablePart;
using WorkbookPart = DocumentFormat.OpenXml.Packaging.WorkbookPart;
using SlidePart = DocumentFormat.OpenXml.Packaging.SlidePart;
using SlideId = DocumentFormat.OpenXml.Presentation.SlideId;

namespace SAXMegaMindDocuments
{
    public static class DocumentTextExtractor
    {
        public static string ExtractText(byte[] fileContent, string fileName, ILogger logger)
        {
            var extension = System.IO.Path.GetExtension(fileName)?.ToLower();
            
            try
            {
                return extension switch
                {
                    ".pdf" => ExtractPdfText(fileContent, logger),
                    ".docx" => ExtractDocxText(fileContent, logger),
                    ".doc" => ExtractDocText(fileContent, logger),
                    ".xlsx" => ExtractXlsxText(fileContent, logger),
                    ".xls" => ExtractXlsText(fileContent, logger),
                    ".pptx" => ExtractPptxText(fileContent, logger),
                    ".ppt" => ExtractPptText(fileContent, logger),
                    ".txt" => Encoding.UTF8.GetString(fileContent),
                    ".csv" => Encoding.UTF8.GetString(fileContent),
                    ".html" or ".htm" => ExtractHtmlText(fileContent, logger),
                    ".xml" => Encoding.UTF8.GetString(fileContent),
                    ".json" => Encoding.UTF8.GetString(fileContent),
                    _ => string.Empty
                };
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"Failed to extract text from {fileName}: {ex.Message}");
                return string.Empty;
            }
        }

        private static string ExtractPdfText(byte[] fileContent, ILogger logger)
        {
            try
            {
                var text = new StringBuilder();
                using (var document = PdfDocument.Open(fileContent))
                {
                    foreach (var page in document.GetPages())
                    {
                        var pageText = ContentOrderTextExtractor.GetText(page);
                        text.Append(pageText);
                        text.Append(" ");
                    }
                }
                return text.ToString();
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"PDF extraction failed: {ex.Message}");
                return string.Empty;
            }
        }

        private static string ExtractDocxText(byte[] fileContent, ILogger logger)
        {
            try
            {
                var text = new StringBuilder();
                using (var stream = new MemoryStream(fileContent))
                using (var doc = WordprocessingDocument.Open(stream, false))
                {
                    var body = doc.MainDocumentPart?.Document?.Body;
                    if (body != null)
                    {
                        // Extract paragraphs
                        foreach (var paragraph in body.Elements<Paragraph>())
                        {
                            text.AppendLine(paragraph.InnerText);
                        }
                        
                        // Extract tables
                        foreach (var table in body.Elements<Table>())
                        {
                            foreach (var row in table.Elements<TableRow>())
                            {
                                foreach (var cell in row.Elements<TableCell>())
                                {
                                    text.Append(cell.InnerText + " ");
                                }
                                text.AppendLine();
                            }
                        }
                    }

                    // Also extract headers and footers
                    var headers = doc.MainDocumentPart?.HeaderParts;
                    if (headers != null)
                    {
                        foreach (var header in headers)
                        {
                            text.AppendLine(header.Header?.InnerText ?? "");
                        }
                    }

                    var footers = doc.MainDocumentPart?.FooterParts;
                    if (footers != null)
                    {
                        foreach (var footer in footers)
                        {
                            text.AppendLine(footer.Footer?.InnerText ?? "");
                        }
                    }
                }
                return text.ToString();
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"DOCX extraction failed: {ex.Message}");
                return string.Empty;
            }
        }

        private static string ExtractXlsxText(byte[] fileContent, ILogger logger)
        {
            try
            {
                var text = new StringBuilder();
                using (var stream = new MemoryStream(fileContent))
                using (var doc = SpreadsheetDocument.Open(stream, false))
                {
                    var workbookPart = doc.WorkbookPart;
                    var sheets = workbookPart?.Workbook?.Descendants<Sheet>();
                    
                    if (sheets != null)
                    {
                        foreach (var sheet in sheets)
                        {
                            var worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                            var sheetData = worksheetPart.Worksheet.Elements<SheetData>().FirstOrDefault();
                            
                            if (sheetData != null)
                            {
                                text.AppendLine($"Sheet: {sheet.Name}");
                                
                                foreach (var row in sheetData.Elements<Row>())
                                {
                                    foreach (var cell in row.Elements<Cell>())
                                    {
                                        var cellValue = GetCellValue(cell, workbookPart);
                                        text.Append(cellValue + "\t");
                                    }
                                    text.AppendLine();
                                }
                            }
                        }
                    }
                }
                return text.ToString();
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"XLSX extraction failed: {ex.Message}");
                return string.Empty;
            }
        }

        private static string GetCellValue(Cell cell, WorkbookPart workbookPart)
        {
            if (cell.CellValue == null) return string.Empty;
            
            string value = cell.CellValue.InnerText;
            
            if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString)
            {
                var stringTable = workbookPart.GetPartsOfType<SharedStringTablePart>().FirstOrDefault();
                if (stringTable != null)
                {
                    value = stringTable.SharedStringTable.ElementAt(int.Parse(value)).InnerText;
                }
            }
            
            return value;
        }

        private static string ExtractPptxText(byte[] fileContent, ILogger logger)
        {
            try
            {
                var text = new StringBuilder();
                using (var stream = new MemoryStream(fileContent))
                using (var doc = PresentationDocument.Open(stream, false))
                {
                    var presentationPart = doc.PresentationPart;
                    var presentation = presentationPart?.Presentation;
                    
                    if (presentation?.SlideIdList != null)
                    {
                        foreach (var slideId in presentation.SlideIdList.Elements<SlideId>())
                        {
                            var slidePart = (SlidePart)presentationPart.GetPartById(slideId.RelationshipId);
                            var slide = slidePart.Slide;
                            
                            // Extract text from all shapes in the slide
                            var texts = slide.Descendants<DocumentFormat.OpenXml.Drawing.Text>();
                            foreach (var t in texts)
                            {
                                text.AppendLine(t.Text);
                            }
                            
                            // Extract text from notes
                            if (slidePart.NotesSlidePart != null)
                            {
                                var notes = slidePart.NotesSlidePart.NotesSlide.Descendants<DocumentFormat.OpenXml.Drawing.Text>();
                                foreach (var note in notes)
                                {
                                    text.AppendLine(note.Text);
                                }
                            }
                        }
                    }
                }
                return text.ToString();
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"PPTX extraction failed: {ex.Message}");
                return string.Empty;
            }
        }

        private static string ExtractDocText(byte[] fileContent, ILogger logger)
        {
            // Legacy .doc files are more complex, return empty for now
            // Could use Microsoft.Office.Interop.Word if available, or a third-party library
            logger?.LogWarning("Legacy .doc format not fully supported, text extraction may be limited");
            return string.Empty;
        }

        private static string ExtractXlsText(byte[] fileContent, ILogger logger)
        {
            // Legacy .xls files are more complex, return empty for now
            // Could use NPOI or similar library for full support
            logger?.LogWarning("Legacy .xls format not fully supported, text extraction may be limited");
            return string.Empty;
        }

        private static string ExtractPptText(byte[] fileContent, ILogger logger)
        {
            // Legacy .ppt files are more complex, return empty for now
            logger?.LogWarning("Legacy .ppt format not fully supported, text extraction may be limited");
            return string.Empty;
        }

        private static string ExtractHtmlText(byte[] fileContent, ILogger logger)
        {
            try
            {
                var html = Encoding.UTF8.GetString(fileContent);
                // Simple HTML tag removal - for production use HtmlAgilityPack
                var text = System.Text.RegularExpressions.Regex.Replace(html, "<.*?>", " ");
                text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ");
                return System.Net.WebUtility.HtmlDecode(text);
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"HTML extraction failed: {ex.Message}");
                return string.Empty;
            }
        }
    }
}
