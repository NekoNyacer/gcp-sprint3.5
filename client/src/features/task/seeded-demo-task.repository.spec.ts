import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SeededDemoTaskRepository, calculateDistanceMeters } from './seeded-demo-task.repository';

describe('SeededDemoTaskRepository', () => {
  it('adopts published locations, removes unpublished tasks, and retains completed history and rewards', async () => {
    const repository = new SeededDemoTaskRepository();
    const definition = {id: 'cms-task', name: '新每日任務', description: '', areaId: 'banqiao' as const,
      cadence: 'daily' as const, enabled: true, startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(), destinationName: '新地點', address: '',
      latitude: 25, longitude: 121, rewardAmount: 4};
    repository.setPublishedTasks([definition]);
    const task = (await firstValueFrom(repository.watchTasks('banqiao')))[0];
    expect(task.destination.latitude).toBe(25);
    const result = await repository.completeTask(task.taskId, repository.locationFor(task, 'eligible'));
    repository.setPublishedTasks([{...definition, rewardAmount: 99}]);
    expect((await firstValueFrom(repository.watchHistory('banqiao')))[0].reward).toEqual(result.reward);
    repository.setPublishedTasks([]);
    expect((await firstValueFrom(repository.watchHistory('banqiao')))[0].taskId).toBe('cms-task');
    await expect(repository.completeTask('banqiao-daily-1', repository.locationFor(task, 'eligible'))).rejects.toThrow('找不到任務');
  });
  it('only exposes tasks from the selected area', async () => {
    const repository = new SeededDemoTaskRepository();
    const tasks = await firstValueFrom(repository.watchTasks('banqiao'));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.areaId === 'banqiao')).toBe(true);
  });

  it('requires an event to be joined before completion', async () => {
    const repository = new SeededDemoTaskRepository();
    const tasks = await firstValueFrom(repository.watchTasks('banqiao'));
    const task = tasks.find((candidate) => candidate.cadence === 'event')!;
    await expect(repository.completeTask(task.taskId, repository.locationFor(task, 'eligible'))).rejects.toThrow('請先參加活動');
  });

  it('completes once and returns the prior inventory on a duplicate attempt', async () => {
    const repository = new SeededDemoTaskRepository();
    const tasks = await firstValueFrom(repository.watchTasks('banqiao'));
    const task = tasks.find((candidate) => candidate.cadence === 'daily')!;
    const location = repository.locationFor(task, 'eligible');
    const first = await repository.completeTask(task.taskId, location);
    const duplicate = await repository.completeTask(task.taskId, location);
    expect(first.inventory).toEqual(duplicate.inventory);
    expect(first.reward).toEqual(task.reward);
  });

  it('distinguishes distance from reported accuracy', async () => {
    const repository = new SeededDemoTaskRepository();
    const task = (await firstValueFrom(repository.watchTasks('banqiao')))[0];
    await expect(repository.completeTask(task.taskId, repository.locationFor(task, 'poor-accuracy'))).rejects.toThrow('定位精確度不足');
    expect(calculateDistanceMeters(repository.locationFor(task, 'eligible'), task.destination)).toBeLessThanOrEqual(10);
  });
});
