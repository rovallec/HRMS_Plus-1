import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppeasementService } from '../services/appeasement.service';

type ChangeType = 'none' | 'added' | 'removed' | 'modified';

interface Job {
  id: number;
  job_type: string;
}

interface DiffNode {
  name: string;
  change: ChangeType;
  oldValue?: any;
  newValue?: any;
  children?: DiffNode[];
}


@Component({
  selector: 'app-kimco-dbchanges',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kimco-dbchanges.html',
  styleUrls: ['./kimco-dbchanges.css']
})
export class KimcoDbChangesComponent implements OnInit {

  jobs: Job[] = [];

  selectedOldJob: number | null = null;
  selectedNewJob: number | null = null;

  diffReady = false;

  diffTree: DiffNode[] = [];
  changedBuildings: any[] = [];

  loading = false;

  constructor(private service: AppeasementService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  // =========================
// BUILDING SELECT HANDLER
// =========================
selectBuilding(b: any) {
  console.log('Selected building:', b);

  // opcional: si luego quieres modal o highlight
  // this.selectedBuilding = b;
}

  // =========================
  // LOAD JOBS
  // =========================
  loadJobs() {
    this.service.getKimcoJobs()
      .subscribe(res => {
        this.jobs = res?.data ?? res;
      });
  }

  // =========================
  // VALIDATION
  // =========================
  canCompare(): boolean {
    return !!this.selectedOldJob && !!this.selectedNewJob;
  }

  // =========================
  // MAIN ACTION
  // =========================
  calculateChanges() {

    if (!this.canCompare()) return;

    this.loading = true;
    this.diffReady = false;

    this.service.getKimcoPayloads(
      this.selectedOldJob!,
      this.selectedNewJob!
    ).subscribe(res => {

      const oldPayload = res?.data?.old?.data ?? res?.old ?? {};
      const newPayload = res?.data?.new?.data ?? res?.new ?? {};

      this.diffTree = this.buildDiffTree('root', oldPayload, newPayload);
      this.changedBuildings = this.extractChangedBuildings(this.diffTree);

      this.diffReady = true;
      this.loading = false;
    });
  }

  // =========================
  // DIFF ENGINE
  // =========================
  buildDiffTree(name: string, oldVal: any, newVal: any): DiffNode[] {

    const nodes: DiffNode[] = [];

    const oldKeys = oldVal && typeof oldVal === 'object' ? Object.keys(oldVal) : [];
    const newKeys = newVal && typeof newVal === 'object' ? Object.keys(newVal) : [];

    const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));

    for (const key of allKeys) {

      const o = oldVal?.[key];
      const n = newVal?.[key];

      let node: DiffNode = {
        name: key,
        change: 'none',
        children: []
      };

      // ADDED
      if (o === undefined && n !== undefined) {
        node.change = 'added';
        node.newValue = n;
      }

      // REMOVED
      else if (o !== undefined && n === undefined) {
        node.change = 'removed';
        node.oldValue = o;
      }

      // OBJECT RECURSION
      else if (this.isObject(o) || this.isObject(n)) {
        node.children = this.buildDiffTree(key, o || {}, n || {});
        node.change = this.inheritChange(node.children);
      }

      // PRIMITIVE
      else {
        if (o === n) {
          node.change = 'none';
        } else {
          node.change = 'modified';
          node.oldValue = o;
          node.newValue = n;
        }
      }

      nodes.push(node);
    }

    return nodes;
  }

  // =========================
  inheritChange(children: DiffNode[]): ChangeType {

    let worst: ChangeType = 'none';

    for (const c of children) {
      if (this.rank(c.change) > this.rank(worst)) {
        worst = c.change;
      }
    }

    return worst;
  }

  rank(c: ChangeType): number {
    switch (c) {
      case 'added': return 3;
      case 'removed': return 3;
      case 'modified': return 2;
      default: return 1;
    }
  }

  // =========================
  extractChangedBuildings(tree: DiffNode[]): any[] {

    const result: any[] = [];

    const walk = (nodes: DiffNode[]) => {
      for (const n of nodes) {
        if (n.change !== 'none') {
          result.push({
            name: n.name,
            change: n.change
          });
        }
        if (n.children?.length) walk(n.children);
      }
    };

    walk(tree);

    return result;
  }

  isObject(v: any): boolean {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  // =========================
  // UI HELP
  // =========================
  selectOldJob(id: number) {
    this.selectedOldJob = id;
  }

  selectNewJob(id: number) {
    this.selectedNewJob = id;
  }

  openNode(node: DiffNode) {
    alert(
      `Change: ${node.change}\n\n` +
      `Old: ${JSON.stringify(node.oldValue, null, 2)}\n\n` +
      `New: ${JSON.stringify(node.newValue, null, 2)}`
    );
  }
}