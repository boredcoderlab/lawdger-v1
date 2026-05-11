"use client";

import { useState } from 'react';
import {
  CheckCircle2, Clock, Plus, X, Trash2, Calendar as CalendarIcon, MoreHorizontal, Inbox, Users, Briefcase, FileText, Activity
} from 'lucide-react';
import Link from 'next/link';
import {
  format, isPast, isToday, isTomorrow, differenceInDays
} from 'date-fns';
import { createTask, updateTaskStatus, deleteTask, updateTaskAssignee } from '@/actions/taskActions';
import { PageLayout, DarkPaneHeaderTitle, ContentHeading } from '@/components/ui/LayoutShell';

type Task = {
  id: string;
  description: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  case: { id: string; title: string } | null;
  assignee?: string; 
};

type CaseOption = { id: string; title: string };

const ASSIGNMENT_COLS = ["My Plate", "Associates", "Clerks & Filings"];

export default function TasksClient({
  initialTasks,
  cases,
}: {
  initialTasks: Task[];
  cases: CaseOption[];
}) {
  const [tasks, setTasks] = useState<Task[]>(
    initialTasks.map((t) => ({
      ...t,
      assignee: t.assignee || 'Unassigned'
    }))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    desc: '',
    due: format(new Date(), 'yyyy-MM-dd'),
    caseId: cases[0]?.id ?? '',
    assignee: 'Unassigned',
  });

  const openModal = () => {
    setNewTask({ desc: '', due: format(new Date(), 'yyyy-MM-dd'), caseId: cases[0]?.id ?? '', assignee: 'Unassigned' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.caseId) return;
    
    const tempTask: Task = {
      id: Math.random().toString(),
      description: newTask.desc,
      status: 'pending',
      dueDate: newTask.due ? new Date(newTask.due) : null,
      createdAt: new Date(),
      case: cases.find(c => c.id === newTask.caseId) || null,
      assignee: newTask.assignee,
    };
    
    setTasks([tempTask, ...tasks]);
    closeModal();
    
    await createTask({
      caseId: newTask.caseId,
      description: newTask.desc,
      dueDate: newTask.due ? new Date(newTask.due) : undefined,
      assignee: newTask.assignee,
    });
  };

  const getDueLabel = (date: Date | null) => {
    if (!date) return 'No due date';
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    const diff = differenceInDays(date, new Date());
    if (diff < 7) return `In ${diff} days`;
    return format(date, 'MMM d');
  };

  const getDueColor = (date: Date | null) => {
    if (!date) return 'text-muted-foreground bg-muted/50 border-transparent';
    if (isPast(date) && !isToday(date)) return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';
    if (isToday(date)) return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-muted-foreground bg-muted/50 border-border/50';
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    setTimeout(() => {
        const el = document.getElementById(`task-${taskId}`);
        if(el) el.classList.add('opacity-40', 'scale-95');
    }, 0);
  };
  
  const handleDragEnd = (e: React.DragEvent, taskId: string) => {
    const el = document.getElementById(`task-${taskId}`);
    if(el) el.classList.remove('opacity-40', 'scale-95');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };
  
  const handleDragEnter = (e: React.DragEvent, colName: string) => {
      e.preventDefault();
      const colEl = document.getElementById(`col-${colName.replace(/ /g, '-')}`);
      if(colEl) colEl.classList.add('bg-primary/5', 'border-primary/30');
  };
  
  const handleDragLeave = (e: React.DragEvent, colName: string) => {
      e.preventDefault();
      const colEl = document.getElementById(`col-${colName.replace(/ /g, '-')}`);
      if(colEl) colEl.classList.remove('bg-primary/5', 'border-primary/30');
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    const colEl = document.getElementById(`col-${targetColumn.replace(/ /g, '-')}`);
    if(colEl) colEl.classList.remove('bg-primary/5', 'border-primary/30');
    
    const taskId = e.dataTransfer.getData("taskId");
    
    setTasks(prev => 
      prev.map(t => t.id === taskId ? { ...t, assignee: targetColumn } : t)
    );
    
    try {
      await updateTaskAssignee(taskId, targetColumn);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
     e.stopPropagation();
     setTasks(tasks.filter(t => t.id !== taskId));
     await deleteTask(taskId);
  };

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-12 bg-background  text-foreground">
        <Briefcase className="w-16 h-16 text-primary opacity-30 mb-6" />
        <h2 className="font-serif text-[2rem] font-bold mb-3">Workspace Empty</h2>
        <p className="text-muted-foreground text-[15px] font-medium max-w-md leading-relaxed">Create a master case file first to begin delegating assignments and orchestrating your team.</p>
        <Link href="/cases" className="mt-8 px-8 py-3.5 bg-primary text-primary-foreground rounded-full text-[13px] font-bold shadow-lg hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] hover:scale-105 transition-all tracking-wide uppercase">
          Initialize First Case
        </Link>
      </div>
    );
  }

  const overdueCount = tasks.filter(t => t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate)).length;
  const pendingCount = tasks.length;
  const todayCount = tasks.filter(t => t.dueDate && isToday(t.dueDate)).length;
  const unassignedTasks = tasks.filter(t => t.assignee === "Unassigned");

  return (
    <>
      <PageLayout
        pageTitle="Tasks"
        headerAction={
          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-full hover:scale-[1.02] transition-transform font-bold tracking-widest uppercase text-[12px] shadow-[0_0_20px_rgba(200,150,62,0.3)]"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        }
        darkPaneHeader={<DarkPaneHeaderTitle icon={Activity} title="Orchestration" subtitle="Metrics & Delegation" />}
        darkPaneContent={
          <>
            <div className="grid grid-cols-1 gap-4 mb-10 shrink-0">
              <div className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-inner backdrop-blur-md">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold">Total Pending</span>
                <p className="text-[2.5rem] font-serif font-bold text-[#f4efe8] mt-1">{tasks.filter(t => t.status !== 'done').length}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#3A2E26]/50 rounded-3xl p-5 border border-white/5 backdrop-blur-sm">
                  <span className="text-[10px] uppercase tracking-widest text-orange-200/50 font-bold">Due Today</span>
                  <p className="text-[1.6rem] font-bold text-orange-400 mt-1">{tasks.filter(t => t.dueDate && isToday(t.dueDate)).length}</p>
                </div>
                <div className="bg-[#3A2E26]/50 rounded-3xl p-5 border border-white/5 backdrop-blur-sm">
                  <span className="text-[10px] uppercase tracking-widest text-red-200/50 font-bold">Overdue</span>
                  <p className="text-[1.6rem] font-bold text-red-400 mt-1">{tasks.filter(t => t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate) && t.status !== 'done').length}</p>
                </div>
              </div>
            </div>

            <div 
               id="col-Unassigned" 
               className="flex-1 bg-black/20 border border-white/10 rounded-3xl p-5 overflow-y-auto scrollbar-hide flex flex-col gap-3 transition-colors"
               onDragOver={handleDragOver}
               onDragEnter={(e) => handleDragEnter(e, "Unassigned")}
               onDragLeave={(e) => handleDragLeave(e, "Unassigned")}
               onDrop={(e) => handleDrop(e, "Unassigned")}
            >
               <div className="flex items-center gap-2 mb-4 px-2">
                  <Inbox className="w-4 h-4 text-white/50" />
                  <h3 className="font-bold text-[12px] uppercase tracking-widest text-white/70">Inbox Tray ({tasks.filter(t => t.assignee === "Unassigned").length})</h3>
               </div>

               {tasks.filter(t => t.assignee === "Unassigned").map((task) => (
                  <div 
                    key={task.id}
                    id={`task-${task.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={(e) => handleDragEnd(e, task.id)}
                    className="bg-[#291e16] rounded-xl p-4 shadow-sm border border-white/10 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:-translate-y-1 transition-all duration-200 group relative overflow-hidden shrink-0"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-white/10 px-2 py-0.5 rounded-md">
                        <span className="font-serif text-[11px] font-semibold italic text-[#f4efe8]/80 block truncate max-w-[150px]">
                          {task.case?.title || 'General'}
                        </span>
                      </div>
                    </div>
                    <p className="font-medium text-[13px] leading-snug mb-3 text-[#f4efe8]/90 line-clamp-2">{task.description}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${getDueColor(task.dueDate)} shadow-sm`}>
                        <Clock className="w-3 h-3" />
                        {getDueLabel(task.dueDate)}
                      </div>
                      <button onClick={(e) => handleDelete(e, task.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
               ))}
            </div>
          </>
        }
        mainPaneHeader={
          <>
            <div className="flex items-center gap-4">
              <ContentHeading>Active Assignments</ContentHeading>
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">LIVE</span>
            </div>
            <button
              onClick={openModal}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl transition-all font-bold tracking-wider uppercase text-[11px] flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Assignment
            </button>
          </>
        }
        mainPaneContent={
          <div className="p-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
             {ASSIGNMENT_COLS.map((colName) => {
               const colTasks = tasks.filter(t => t.assignee === colName);
               
               let Icon = Users;
               if (colName === "My Plate") Icon = Briefcase;
               if (colName === "Clerks & Filings") Icon = FileText;

               return (
                  <div 
                    key={colName}
                    id={`col-${colName.replace(/ /g, '-')}`}
                    className="flex flex-col h-full bg-white/70 dark:bg-card/40 backdrop-blur-xl border border-white/80 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm transition-all"
                   onDragOver={handleDragOver}
                   onDragEnter={(e) => handleDragEnter(e, colName)}
                   onDragLeave={(e) => handleDragLeave(e, colName)}
                   onDrop={(e) => handleDrop(e, colName)}
                 >
                   <div className="px-6 py-5 border-b border-white/50 dark:border-white/10 flex items-center justify-between bg-white/70 dark:bg-white/5">
                     <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                             <Icon className="w-4 h-4" />
                         </div>
                          <ContentHeading className="text-[1.2rem]">{colName}</ContentHeading>
                      </div>
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/95 dark:bg-black/50 border border-white/50 dark:border-white/10 text-foreground dark:text-white text-[11px] font-bold shadow-sm">
                       {colTasks.length}
                     </span>
                   </div>

                   <div className="flex-1 flex flex-col gap-4 overflow-y-auto p-5 pb-10 scrollbar-hide">
                     {colTasks.map((task) => (
                       <div 
                         key={task.id}
                         id={`task-${task.id}`}
                         draggable
                         onDragStart={(e) => handleDragStart(e, task.id)}
                         onDragEnd={(e) => handleDragEnd(e, task.id)}
                         className="bg-white/90 dark:bg-[#1A1918]/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-white/50 dark:border-white/10 cursor-grab active:cursor-grabbing hover:shadow-[0_8px_25px_rgba(200,150,62,0.15)] hover:border-primary/40 transition-all duration-200 group relative shrink-0"
                       >
                         <div className="bg-[#291e16] dark:bg-black/60 px-4 py-3 flex justify-between items-start border-b border-white/10">
                           <div className="bg-white/40 border border-white/10 px-2.5 py-1 rounded-md shadow-inner">
                             <span className="font-serif text-[11.5px] font-semibold italic text-white/90 truncate max-w-[150px] block">
                               {task.case?.title || 'General Directive'}
                             </span>
                           </div>
                           <button className="text-white/40 opacity-0 group-hover:opacity-100 hover:text-white transition-all p-1">
                             <MoreHorizontal className="w-4 h-4" />
                           </button>
                         </div>
                         
                         <div className="p-4">
                           <p className="font-medium text-[14px] leading-relaxed mb-5 text-gray-800 dark:text-gray-200">{task.description}</p>
                           
                           <div className="flex items-center justify-between mt-auto">
                             <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${getDueColor(task.dueDate)} shadow-sm`}>
                               <Clock className="w-3 h-3" />
                               {getDueLabel(task.dueDate)}
                             </div>
                             
                             <button 
                               onClick={(e) => handleDelete(e, task.id)}
                               className="opacity-0 group-hover:opacity-100 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-all"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </div>
                       </div>
                     ))}

                     {colTasks.length === 0 && (
                       <div className="flex flex-col items-center justify-center h-32 text-center px-4 rounded-xl border border-dashed border-primary/30 bg-white/95 dark:bg-black/10 shrink-0">
                         <CheckCircle2 className="w-5 h-5 text-primary/40 mb-2" />
                         <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">The desk is clear</p>
                       </div>
                     )}
                   </div>
                 </div>
               );
             })}
            </div>
          </div>
        }
      />

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-background  rounded-[1.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden relative border border-white/60 dark:border-primary/20 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 bg-white dark:bg-[#1A1918] border-b border-primary/10">
              <div className="flex items-center gap-4">
                 <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Plus className="w-5 h-5" />
                 </div>
                 <div>
                    <ContentHeading className="text-[1.5rem]">Delegate Task</ContentHeading>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary/60 mt-1.5">Issue a new directive</p>
                 </div>
              </div>
              <button onClick={closeModal} className="text-foreground/40 hover:text-foreground transition-colors p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="p-8 space-y-6">
              
              <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Assign To</label>
                    <select
                      value={newTask.assignee}
                      onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                      className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium text-foreground shadow-sm appearance-none"
                    >
                      <option value="Unassigned">Unassigned (Inbox)</option>
                      {ASSIGNMENT_COLS.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Target Date</label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="date"
                          required
                          value={newTask.due}
                          onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
                          className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl pl-10 pr-4 py-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm text-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
                        />
                    </div>
                  </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Master Case File</label>
                <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <select
                      required
                      value={newTask.caseId}
                      onChange={(e) => setNewTask({ ...newTask, caseId: e.target.value })}
                      className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl pl-10 pr-4 py-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium text-foreground shadow-sm appearance-none"
                    >
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Task Directive</label>
                <textarea
                  required
                  rows={3}
                  value={newTask.desc}
                  onChange={(e) => setNewTask({ ...newTask, desc: e.target.value })}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm text-foreground resize-none"
                  placeholder="e.g. Draft the rejoinder for the interim application..."
                />
              </div>

              <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] hover:scale-[1.01] transition-all uppercase tracking-widest text-[12px]"
                  >
                    Dispatch Assignment
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
