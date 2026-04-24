import { motion } from 'framer-motion';
import { Trophy, ArrowRight, X } from 'lucide-react';

export default function SprintCompletionBanner({ stats, onComplete, onDismiss, isMultiSprint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <Trophy className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-800">All tasks complete!</h3>
            <p className="mt-1 text-sm text-emerald-700">
              {stats.done}/{stats.total} issues done
              {stats.donePoints > 0 && ` · ${stats.donePoints} story points delivered`}
            </p>
            {isMultiSprint && (
              <p className="mt-1 text-xs text-emerald-600">
                Completing this sprint will start the next one automatically.
              </p>
            )}
          </div>
        </div>
        <button onClick={onDismiss} className="text-emerald-400 hover:text-emerald-600 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onComplete}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Complete Sprint
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
