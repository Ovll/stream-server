import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMediaFilename } from './filenameParser.js';

describe('parseMediaFilename', () => {
    describe('series — full filename', () => {
        it('parses title, season, episode from dot-separated filename', () => {
            const result = parseMediaFilename('Breaking.Bad.S01E01.Pilot.1080p.mkv');
            assert.equal(result.type, 'series');
            assert.equal(result.title, 'Breaking Bad');
            assert.equal(result.seasonNumber, 1);
            assert.equal(result.episodeNumber, 1);
            assert.equal(result.episodeTitle, 'Pilot');
        });

        it('strips release year between title and SxxExx', () => {
            const result = parseMediaFilename('CIA.2026.S01E11.Forbidden.Eye.mkv');
            assert.equal(result.type, 'series');
            assert.equal(result.title, 'CIA');
            assert.equal(result.year, 2026);
        });
    });

    describe('series — folder-name fallback', () => {
        it('uses folderName when filename has no title prefix', () => {
            const result = parseMediaFilename('S02E05.mkv', 'Breaking Bad');
            assert.equal(result.type, 'series');
            assert.equal(result.title, 'Breaking Bad');
            assert.equal(result.seasonNumber, 2);
            assert.equal(result.episodeNumber, 5);
        });

        it('strips parenthetical year from folderName', () => {
            const result = parseMediaFilename('S01E01.mkv', 'Breaking Bad (2008)');
            assert.equal(result.title, 'Breaking Bad');
        });

        it('filename title takes priority over folderName', () => {
            const result = parseMediaFilename('Breaking.Bad.S01E01.Pilot.mkv', 'Some Other Folder');
            assert.equal(result.title, 'Breaking Bad');
        });

        it('returns empty title when no folderName given and filename has no prefix', () => {
            const result = parseMediaFilename('S01E01.mkv');
            assert.equal(result.type, 'series');
            assert.equal(result.title, '');
        });
    });

    describe('series — episode title before SxxExx', () => {
        it('strips episode title prefix and year from title', () => {
            const result = parseMediaFilename(
                'The IT Crowd 2006 The Work Outing S02E01 1080p WEB-DL HEVC x265 BONE.mkv',
            );
            assert.equal(result.type, 'series');
            assert.equal(result.title, 'The IT Crowd');
            assert.equal(result.year, 2006);
            assert.equal(result.seasonNumber, 2);
            assert.equal(result.episodeNumber, 1);
        });

        it('handles multiple words of episode prefix before SxxExx', () => {
            const result = parseMediaFilename(
                'The IT Crowd 2006 Jen the Fredo S04E01 1080p WEB-DL HEVC x265 BONE.mkv',
            );
            assert.equal(result.title, 'The IT Crowd');
            assert.equal(result.year, 2006);
            assert.equal(result.seasonNumber, 4);
            assert.equal(result.episodeNumber, 1);
        });
    });

    describe('series — season without episode number', () => {
        it('defaults episodeNumber to 1 when only Sxx is present', () => {
            const result = parseMediaFilename(
                'The IT Crowd 2006 S05 The Internet is Coming 1080p WEB-DL HEVC x265 BONE.mkv',
            );
            assert.equal(result.type, 'series');
            assert.equal(result.title, 'The IT Crowd');
            assert.equal(result.year, 2006);
            assert.equal(result.seasonNumber, 5);
            assert.equal(result.episodeNumber, 1);
        });
    });

    describe('movies', () => {
        it('parses title and year', () => {
            const result = parseMediaFilename('The.Batman.2022.mkv');
            assert.equal(result.type, 'movie');
            assert.equal(result.title, 'The Batman');
            assert.equal(result.year, 2022);
        });

        it('returns movie type for bare filename with no year', () => {
            const result = parseMediaFilename('Interstellar.mkv');
            assert.equal(result.type, 'movie');
            assert.equal(result.title, 'Interstellar');
        });
    });
});
