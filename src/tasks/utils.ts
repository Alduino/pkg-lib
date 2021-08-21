import {createStaticTaskCurry, createTaskTypingsHelper} from "../utils/tasks";
import TaskContext from "./TaskContext";

export const withTypings = createTaskTypingsHelper<TaskContext>();
export const createStaticTask = createStaticTaskCurry<TaskContext>();
