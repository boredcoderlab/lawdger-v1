"use client";

import { useState } from 'react';
import {
  CheckCircle2, Clock, AlertCircle, Plus, SortDesc, SortAsc,
  X, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Link2,
} from 'lucide-react';
import Link from 'next/link';
import {
  format, isPast, isToday, isTomorrow, differenceInDays, parse,
  subMonths, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth,
} from 'date-fns';
import { createTask, updateTaskStatus, deleteTask } from '@/actions/taskActions';

type Task = {
  id: string;
  description: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  case: { id: string; title: string } | null;
};

type CaseOption = { id: string; title: string };

export default function TasksClient({
  initialTasks,
  cases,
}: {
  initialTasks: Task[];
  cases: CaseOption[];
}) {
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [sortAscending, setSortAscending] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    desc: '',
    due: format(new Date(), 'yyyy-MM-dd'),
    caseId: cases[0]?.id ?? '',
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date());

  const openModal = () => {
    setNewTask({ desc: '', due: format(new Date(), 'yyyy-MM-dd'), caseId: cases[0]?.id ?? '' });
    setPickerMonth(new Date());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDatePickerOpen(false);
  };

  const filteredTasks = initialTasks
    .filter((task) => {
      if (filter === 'Pending') return task.status === 'pending';
      if (filter === 'Completed') return task.status === 'completed';
      return true;
    })
    .sort((a, b) => {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDate === bDate) return 0;
      return sortAscending ? aDate - bDate : bDate - aDate;
    });

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    await updateTaskStatus(id, newStatus as 'pending' | 'completed');
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.caseId) return;
    await createTask({
      caseId: newTask.caseId,
      description: newTask.desc,
      dueDate: newTask.due ? new Date(newTask.due) : undefined,
    });
    closeModal();
  };

  const getDueLabel = (date: Date | null) => {
    if (!date) return 'No due date';
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    const diff = differenceInDays(date, new Date());
    if (diff < 7) return `In ${diff} days`;
    return format(date, 'MMM d, yyyy');
  };

  if (cases.length === 0) {
    return (
      <>
        <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-2">Master Task List</h1>
          <p className="text-muted-foreground text-lg font-light">Your actionable items across all cases.</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
          <p className="text-muted-foreground font-light">Tasks belong to cases. Create a case first to add tasks.</p>
          <Link href="/cases" className="bg-accent text-accent-foreground px-6 py-2.5 rounded-full text-sm font-medium hover:scale-105 transition-transform">
            Go to Cases →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-2">Master Task List</h1>
            <p className="text-muted-foreground text-lg font-light">Your actionable items across all cases.</p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-full hover:scale-105 transition-transform font-medium shadow-[0_0_20px_rgba(243,225,215,0.2)]"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>
      </div>

      <div className="p-8 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">

          <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
            <div className="flex bg-card/60 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-sm">
              {(['All', 'Pending', 'Completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2 rounded-full text-sm transition-colors ${filter === f ? 'bg-white/10 font-medium text-foreground shadow-sm' : 'font-light text-muted-foreground hover:text-foreground'}`}
                >
                  {f}{f === 'All' ? ' Tasks' : ''}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortAscending(!sortAscending)}
              className="flex items-center gap-2 px-5 py-2.5 bg-card/60 backdrop-blur-xl border border-white/10 rounded-full text-foreground hover:bg-white/5 transition-colors text-sm font-medium"
            >
              {sortAscending ? <SortAsc className="h-4 w-4 text-accent" /> : <SortDesc className="h-4 w-4 text-accent" />}
              Sort by Due Date
            </button>
          </div>

          <div className="rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground font-light">No tasks found.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredTasks.map((task) => {
                  const dueLabel = getDueLabel(task.dueDate);
                  const isOverdue = dueLabel === 'Overdue' && task.status !== 'completed';

                  return (
                    <div
                      key={task.id}
                      className={`p-6 transition-all hover:bg-white/5 flex items-start gap-5 group ${task.status === 'completed' ? 'opacity-50' : ''}`}
                    >
                      <button
                        onClick={() => handleToggleStatus(task.id, task.status)}
                        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors shadow-sm ${task.status === 'completed' ? 'bg-accent border-accent text-accent-foreground' : 'border-white/20 bg-background group-hover:border-accent text-transparent group-hover:text-accent/50'}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>

                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className={`font-medium text-lg transition-colors ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground group-hover:text-accent'}`}>
                            {task.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {task.case && (
                              <>
                                <Link href={`/cases/${task.case.id}`} className="flex items-center gap-1 text-sm font-light text-muted-foreground hover:text-accent transition-colors underline decoration-white/20 underline-offset-4">
                                  <Link2 className="h-3 w-3" />
                                  {task.case.title}
                                </Link>
                                <span className="w-1 h-1 rounded-full bg-border" />
                              </>
                            )}
                            <span className="text-xs font-light text-muted-foreground">
                              {format(new Date(task.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-4">
                          {task.dueDate && (
                            <span className={`flex items-center gap-1.5 text-sm font-medium ${isOverdue ? 'text-red-400' : dueLabel === 'Today' ? 'text-orange-400' : 'text-muted-foreground'}`}>
                              {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                              {dueLabel}
                            </span>
                          )}
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-visible relative">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="font-serif text-2xl font-medium">New Task</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Case</label>
                <select
                  required
                  value={newTask.caseId}
                  onChange={(e) => setNewTask({ ...newTask, caseId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id} className="bg-card">{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Description</label>
                <input
                  type="text"
                  required
                  value={newTask.desc}
                  onChange={(e) => setNewTask({ ...newTask, desc: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="e.g. Draft settlement agreement"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Due Date</label>
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all text-left flex justify-between items-center"
                >
                  <span>{newTask.due ? format(parse(newTask.due, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : 'No Date Set'}</span>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {isDatePickerOpen && (
                  <div className="absolute top-full left-0 mt-2 p-4 bg-card border border-white/10 rounded-2xl shadow-2xl z-50 w-[280px] backdrop-blur-3xl">
                    <div className="flex justify-between items-center mb-4">
                      <button type="button" onClick={() => setPickerMonth(subMonths(pickerMonth, 1))} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="font-serif text-sm font-medium">{format(pickerMonth, 'MMMM yyyy')}</span>
                      <button type="button" onClick={() => setPickerMonth(addMonths(pickerMonth, 1))} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="text-[10px] font-medium text-muted-foreground">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {eachDayOfInterval({
                        start: startOfWeek(startOfMonth(pickerMonth)),
                        end: endOfWeek(endOfMonth(pickerMonth)),
                      }).map((day, i) => {
                        const isSelected = newTask.due === format(day, 'yyyy-MM-dd');
                        const inMonth = isSameMonth(day, pickerMonth);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setNewTask({ ...newTask, due: format(day, 'yyyy-MM-dd') }); setIsDatePickerOpen(false); }}
                            className={`p-2 rounded-full text-xs transition-colors flex items-center justify-center ${isSelected ? 'bg-accent text-accent-foreground font-medium' : inMonth ? 'hover:bg-white/10 text-foreground' : 'text-muted-foreground/30'}`}
                          >
                            {format(day, 'd')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-accent text-accent-foreground font-medium py-3 rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
              >
                Save Task
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
