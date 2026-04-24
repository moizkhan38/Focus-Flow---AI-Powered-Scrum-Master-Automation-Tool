import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const iconMap = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', accent: 'bg-emerald-500' },
  error: { icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', accent: 'bg-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', accent: 'bg-amber-500' },
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', accent: 'bg-blue-500' },
};

export default function NotificationToast() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
      <AnimatePresence>
        {notifications.map((n) => {
          const config = iconMap[n.type] || iconMap.info;
          const Icon = config.icon;
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border ${config.border} ${config.bg} shadow-lg`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />
              <div className="flex items-start gap-3 px-4 py-3 pl-5">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.text}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                </div>
                <button
                  onClick={() => removeNotification(n.id)}
                  className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
