import calculateImageEnvVersionMap, { calculateDeployTimeFromTag } from '../src/utils/calculateImageEnvVersionMap';

jest.mock('../src/utils/logger');

describe('calculateImageEnvVersionMap', () => {
  const repoName = 'test-repo';

  it('returns empty object if no images', () => {
    expect(calculateImageEnvVersionMap([], repoName)).toEqual({});
  });

  it('ignores images without version tags', () => {
    const images = [
      { imageTags: ['not-a-version', 'cidev'] },
      { imageTags: ['staging', 'random'] },
    ];
    expect(calculateImageEnvVersionMap(images as any, repoName)).toEqual({});
  });

  it('handles missing imageTags gracefully', () => {
    const images = [
      {},
      { imageTags: null },
      { imageTags: undefined },
    ];
    expect(calculateImageEnvVersionMap(images as any, repoName)).toEqual({});
  });

  it('maps envs to version and deployTime using realistic tags', () => {
    const images = [
      {
        imageTags: ['0.0.113', 'latest', 'current-development-cidev', 'current-staging-staging', 'deployed-development-cidev', 'deployed-live-live-2026-04-08_12-08-32', 'deployed-staging-staging-2026-04-08_08-14-10', 'current-live-live'],
      },
      {
        imageTags: ['0.0.111', 'deployed-staging-staging-2026-03-09_11-19-09', 'deployed-live-live-2026-03-19_10-08-02'],
      },
      {
        imageTags: ['0.0.112'],
      },
    ];
    const result = calculateImageEnvVersionMap(images as any, repoName);
    expect(result.cidev.version).toBe('0.0.113');
    expect(result.staging.version).toBe('0.0.113');
    expect(result.live.version).toBe('0.0.113');
  });

  it('handles multiple version tags for an image', () => {
    const images = [
      {
        imageTags: ['0.0.1', '2.0.0', 'deployed-live-live-2026-04-08_12-08-32'],
      },
      {
        imageTags: ['0.0.2', 'current-live-live'],
      },
      {
        imageTags: ['0.0.3'],
      },
    ];
    const result = calculateImageEnvVersionMap(images as any, repoName);
    expect(result.live.version).toBe('0.0.2');
  });

  it('maps envs to version and where no deploy times are present', () => {
    const images = [
      {
        imageTags: ['1.0.112', 'latest', 'current-development-cidev'],
      },
      {
        imageTags: ['1.0.110', 'current-live-live'],
      },
      {
        imageTags: ['1.0.111', 'current-staging-staging'],
      },
    ];
    const result = calculateImageEnvVersionMap(images as any, repoName);
    expect(result.cidev.version).toBe('1.0.112');
    expect(result.staging.version).toBe('1.0.111');
    expect(result.live.version).toBe('1.0.110');
  });

  it('maps non-standard envs to version', () => {
    const images = [
      {
        imageTags: ['3.0.25', 'current-development-cidev', 'deployed-development-cidev', 'deployed-development-rebel1', 'current-development-rebel1'],
      },
      {
        imageTags: ['3.0.24', 'current-staging-staging'],
      },
      {
        imageTags: ['3.0.23', 'current-live-live', 'deployed-development-phoenix'],
      },
    ];
    const result = calculateImageEnvVersionMap(images as any, repoName);
    expect(result.cidev.version).toBe('3.0.25');
    expect(result.rebel1.version).toBe('3.0.25');
    expect(result.phoenix.version).toBe('3.0.23');
    expect(result.staging.version).toBe('3.0.24');
    expect(result.live.version).toBe('3.0.23');
  });
});

describe('calculateDeployTimeFromTag', () => {
  it('converts to a Date object', () => {
    const tag = 'deployed-staging-staging-2026-04-13_11-10-09';
    const deployTime = calculateDeployTimeFromTag(tag);
    expect(deployTime).toBeInstanceOf(Date);
    expect(deployTime?.toISOString()).toBe('2026-04-13T10:10:09.000Z');
  });

  it('returns undefined if no deploy time is present in the tag', () => {
    const tag = 'current-development-cidev';
    const deployTime = calculateDeployTimeFromTag(tag);
    expect(deployTime).toBeUndefined();
  });
});