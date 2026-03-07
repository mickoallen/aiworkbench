export namespace store {
	
	export class Project {
	    id: number;
	    name: string;
	    path: string;
	    description: string;
	    session_branch: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.description = source["description"];
	        this.session_branch = source["session_branch"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class QueueItem {
	    id: number;
	    project_id: number;
	    task_id?: number;
	    subtask_id?: number;
	    position: number;
	    status: string;
	    // Go type: time
	    added_at: any;
	    // Go type: time
	    started_at?: any;
	    // Go type: time
	    finished_at?: any;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new QueueItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.task_id = source["task_id"];
	        this.subtask_id = source["subtask_id"];
	        this.position = source["position"];
	        this.status = source["status"];
	        this.added_at = this.convertValues(source["added_at"], null);
	        this.started_at = this.convertValues(source["started_at"], null);
	        this.finished_at = this.convertValues(source["finished_at"], null);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Subtask {
	    id: number;
	    task_id: number;
	    name: string;
	    objective: string;
	    prompt: string;
	    status: string;
	    position: number;
	    agent: string;
	    branch_name: string;
	    pr_number?: number;
	    pr_url: string;
	    canvas_x: number;
	    canvas_y: number;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Subtask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.task_id = source["task_id"];
	        this.name = source["name"];
	        this.objective = source["objective"];
	        this.prompt = source["prompt"];
	        this.status = source["status"];
	        this.position = source["position"];
	        this.agent = source["agent"];
	        this.branch_name = source["branch_name"];
	        this.pr_number = source["pr_number"];
	        this.pr_url = source["pr_url"];
	        this.canvas_x = source["canvas_x"];
	        this.canvas_y = source["canvas_y"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Task {
	    id: number;
	    project_id: number;
	    name: string;
	    objective: string;
	    task_type: string;
	    prompt: string;
	    status: string;
	    canvas_x: number;
	    canvas_y: number;
	    review_enabled: boolean;
	    max_rework: number;
	    rework_count: number;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.name = source["name"];
	        this.objective = source["objective"];
	        this.task_type = source["task_type"];
	        this.prompt = source["prompt"];
	        this.status = source["status"];
	        this.canvas_x = source["canvas_x"];
	        this.canvas_y = source["canvas_y"];
	        this.review_enabled = source["review_enabled"];
	        this.max_rework = source["max_rework"];
	        this.rework_count = source["rework_count"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TaskDependency {
	    task_id: number;
	    depends_on_id: number;
	
	    static createFrom(source: any = {}) {
	        return new TaskDependency(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.task_id = source["task_id"];
	        this.depends_on_id = source["depends_on_id"];
	    }
	}

}

