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

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: number, newStatus: TaskStatus, newPosition: number) => void;
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskMove, onTaskClick, onAddTask }: KanbanBoardProps) {
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

    onTaskMove(taskId, newStatus, newPosition);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto pb-4" data-testid="kanban-board">
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 bg-gray-100 rounded-lg flex flex-col"
              data-testid={`column-${column.id}`}
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold text-gray-700">{column.title}</h3>
                  <span className="text-sm text-gray-500 bg-gray-200 px-2 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
                {onAddTask && (
                  <button
                    onClick={() => onAddTask(column.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                    aria-label={`Add task to ${column.title}`}
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>

              {/* Tasks */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] ${
                      snapshot.isDraggingOver ? 'bg-gray-200' : ''
                    }`}
                    data-testid={`droppable-${column.id}`}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={`task-${task.id}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <TaskCard
                              task={task}
                              onClick={() => onTaskClick?.(task)}
                              isDragging={snapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
