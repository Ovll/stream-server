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

    describe('Russian numbered releases', () => {
        it('parses episode 1', () => {
            const result = parseMediaFilename(
                '01. История его служанки.2026.WEB-DL 1080p.Files-x.mkv',
            );

            assert.equal(result.type, 'series');
            assert.equal(result.title, 'История его служанки');
            assert.equal(result.year, 2026);
            assert.equal(result.seasonNumber, 1);
            assert.equal(result.episodeNumber, 1);
        });

        it('parses episode 2', () => {
            const result = parseMediaFilename(
                '02. История его служанки.2026.WEB-DL 1080p.Files-x.mkv',
            );

            assert.equal(result.episodeNumber, 2);
        });
    });

    describe('anime fansub releases', () => {
        it('parses title and episode from fansub filename and season from folder', () => {
            const result = parseMediaFilename(
                '[AniPlague] Jujutsu Kaisen - 02 [1080p].mkv',
                'Jujutsu Kaisen S01 AniPlague',
            );

            assert.equal(result.type, 'series');
            assert.equal(result.title, 'Jujutsu Kaisen');
            assert.equal(result.year, null);
            assert.equal(result.seasonNumber, 1);
            assert.equal(result.episodeNumber, 2);
            assert.equal(result.episodeTitle, null);
        });

        it('defaults to season 1 when the folder has no season number', () => {
            const result = parseMediaFilename(
                '[SubsPlease] Solo Leveling - 05 (1080p).mkv',
                'Solo Leveling',
            );

            assert.equal(result.type, 'series');
            assert.equal(result.title, 'Solo Leveling');
            assert.equal(result.seasonNumber, 1);
            assert.equal(result.episodeNumber, 5);
        });

        it('supports large anime episode numbers', () => {
            const result = parseMediaFilename(
                '[Erai-raws] One Piece - 1137 [1080p][HEVC].mkv',
                'One Piece S01',
            );

            assert.equal(result.title, 'One Piece');
            assert.equal(result.seasonNumber, 1);
            assert.equal(result.episodeNumber, 1137);
        });

        it('strips END suffix from final episode', () => {
            const result = parseMediaFilename(
                '[Golumpa] JUJUTSU KAISEN - 24 END [CR-Dub 720p x264 AAC] [D8685DC9].mkv',
            );

            assert.equal(result.type, 'series');
            assert.equal(result.title, 'JUJUTSU KAISEN');
            assert.equal(result.seasonNumber, 1);
            assert.equal(result.episodeNumber, 24);
        });
    });
});
