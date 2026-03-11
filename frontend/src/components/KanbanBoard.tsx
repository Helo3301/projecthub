import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/types';

interface Column {
  id: TaskStatus;
  title: string;
  color: string;
}

const columns: Column[] = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-400' },
  { id: 'todo', title: 'To Do', color: 'bg-blue-400' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-yellow-400' },
  { id: 'review', title: 'Review', color: 'bg-purple-400' },
  { id: 'done', title: 'Done', color: 'bg-green-400' },
];

function TaskCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600 animate-pulse">
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove?: (taskId: number, newStatus: TaskStatus, newPosition: number) => void;
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  isLoading?: boolean;
}

export function KanbanBoard({ tasks, onTaskMove, onTaskClick, onAddTask, isLoading = false }: KanbanBoardProps) {
  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.position - b.position);
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskId = parseInt(draggableId.replace('task-', ''), 10);
    const newStatus = destination.droppableId as TaskStatus;
    const newPosition = destination.index;

    onTaskMove?.(taskId, newStatus, newPosition);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto pb-4" role="region" aria-label="Kanban board" data-testid="kanban-board">
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col"
              role="group"
              aria-label={`${column.title} column, ${isLoading ? 'loading' : `${columnTasks.length} ${columnTasks.length === 1 ? 'task' : 'tasks'}`}`}
              data-testid={`column-${column.id}`}
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200">{column.title}</h3>
                  <span className="text-sm text-gray-500 bg-gray-200 dark:bg-gray-700 dark:text-gray-400 px-2 rounded-full">
                    {isLoading ? '…' : columnTasks.length}
                  </span>
                </div>
                {onAddTask && (
                  <button
                    onClick={() => onAddTask(column.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    aria-label={`Add task to ${column.title}`}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Tasks */}
              {isLoading ? (
                <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]" data-testid={`droppable-${column.id}`}>
                  <TaskCardSkeleton />
                  <TaskCardSkeleton />
                </div>
              ) : (
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] ${
                        snapshot.isDraggingOver ? 'bg-gray-200 dark:bg-gray-700' : ''
                      }`}
                      data-testid={`droppable-${column.id}`}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={`task-${task.id}`}
                          index={index}
                          isDragDisabled={!onTaskMove}
                        >
                          {(provided, snapshot) => {
                            const dragEnabled = !!onTaskMove;
                            return (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...(dragEnabled ? provided.dragHandleProps : {})}
                              >
                                <TaskCard
                                  task={task}
                                  onClick={() => onTaskClick?.(task)}
                                  isDragging={snapshot.isDragging}
                                  disableButton={dragEnabled}
                                />
                              </div>
                            );
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
