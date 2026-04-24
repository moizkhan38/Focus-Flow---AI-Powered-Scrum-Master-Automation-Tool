import { FileText, Download, FileJson } from 'lucide-react';
import { exportToPDF, exportToCSV, exportToJSON } from '../../utils/export';

export default function ExportButtons({ report }) {
  if (!report) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => exportToPDF(report)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <FileText className="h-4 w-4 text-red-500" />
        Export PDF
      </button>
      <button
        onClick={() => exportToCSV(report)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Download className="h-4 w-4 text-green-500" />
        Export CSV
      </button>
      <button
        onClick={() => exportToJSON(report)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <FileJson className="h-4 w-4 text-blue-500" />
        Export JSON
      </button>
    </div>
  );
}
