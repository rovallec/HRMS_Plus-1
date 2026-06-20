import { Component, OnInit } from '@angular/core';
import { AppeasementService } from '../services/appeasement.service'; // ajusta path

type ChangeType = 'none' | 'added' | 'removed' | 'modified';

interface Job {
  job_id: number;
  label: string;
}

interface DiffNode {
  name: string;
  change: ChangeType;
  oldValue?: any;
  newValue?: any;
  children?: DiffNode[];
}

@Component({
  selector: 'app-kimco-db-changes',
  standalone: true,
  templateUrl: './kimco-db-changes.component.html',
  styleUrls: ['./kimco-db-changes.component.css']
})
export class KimcoDbChangesComponent implements OnInit {

  jobs: Job[] = [];

  selectedOldJob: number | null = null;
  selectedNewJob: number | null = null;

  diffReady = false;

  diffTree: DiffNode[] = [];
  changedBuildings: any[] = [];

  constructor(private service: AppeasementService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  // =========================
  // LOAD JOBS
  // =========================
  loadJobs() {
    this.service.getKimcoJobs()
      .subscribe(res => {
        this.jobs = res?.data ?? res; // soporta ambos formatos
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

    this.service.getKimcoPayloads(
      this.selectedOldJob!,
      this.selectedNewJob!
    ).subscribe(res => {

      const oldPayload = res?.data?.old?.payload ?? res.old?.payload;
      const newPayload = res?.data?.new?.payload ?? res.new?.payload;

      this.diffTree = this.buildDiffTree('root', oldPayload, newPayload);
      this.changedBuildings = this.extractChangedBuildings(this.diffTree);

      this.diffReady = true;
    });
  }

  // =========================
  // DIFF ENGINE (RECURSIVE)
  // =========================
  buildDiffTree(
    name: string,
    oldVal: any,
    newVal: any
  ): DiffNode[] {

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

      // OBJECT -> RECURSE
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
            name: n.name
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
  openNode(node: DiffNode) {

    alert(
      `Change: ${node.change}\n\n` +
      `Old Value: ${JSON.stringify(node.oldValue, null, 2)}\n\n` +
      `New Value: ${JSON.stringify(node.newValue, null, 2)}`
    );
  }

  selectBuilding(b: any) {
    console.log('building selected', b);
  }
}