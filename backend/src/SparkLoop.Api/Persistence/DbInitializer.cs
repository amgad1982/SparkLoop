using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace SparkLoop.Api.Persistence;

public static class DbInitializer
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            var databaseCreator = dbContext.Database.GetService<IDatabaseCreator>() as RelationalDatabaseCreator;
            if (databaseCreator != null)
            {
                if (!await databaseCreator.ExistsAsync())
                {
                    await databaseCreator.CreateAsync();
                }
                if (!await databaseCreator.HasTablesAsync())
                {
                    await databaseCreator.CreateTablesAsync();
                }
            }
            else
            {
                await dbContext.Database.EnsureCreatedAsync();
            }

            // ---------------------------------------------------------------------
            // Cleanup of removed feature tables.
            // The "Synchronized Daily Sparks" feature was retired; drop its tables
            // here so production databases are not left with orphan data and EF
            // Core schema drift is avoided. Idempotent — IF EXISTS guards the case
            // where the tables were never created (fresh DBs).
            // ---------------------------------------------------------------------
            await dbContext.Database.ExecuteSqlRawAsync(
                "DROP TABLE IF EXISTS \"spark_votes\" CASCADE; " +
                "DROP TABLE IF EXISTS \"spark_submissions\" CASCADE; " +
                "DROP TABLE IF EXISTS \"sparks\" CASCADE;");

            // ---------------------------------------------------------------------
            // Idempotent column additions for User Settings
            // ---------------------------------------------------------------------
            try
            {
                await dbContext.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"NotifyStageInvites\" boolean NOT NULL DEFAULT true; " +
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"NotifyChainTurns\" boolean NOT NULL DEFAULT true; " +
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"NotifyFollows\" boolean NOT NULL DEFAULT true; " +
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"HapticFeedback\" boolean NOT NULL DEFAULT true; " +
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"VoiceRoomVolume\" double precision NOT NULL DEFAULT 1.0; " +
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"BgMusicVolume\" double precision NOT NULL DEFAULT 0.5; " +
                    "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"JoinMicMuted\" boolean NOT NULL DEFAULT true;");
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "User settings columns alteration note");
            }

            // ---------------------------------------------------------------------
            // DJ Lists table & MoodPod DJ columns
            // ---------------------------------------------------------------------
            var isSqlite = dbContext.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;
            if (isSqlite)
            {
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS ""dj_lists"" (
                        ""Id"" TEXT NOT NULL PRIMARY KEY,
                        ""UserId"" TEXT NOT NULL,
                        ""Username"" TEXT NOT NULL,
                        ""UserDisplayName"" TEXT NOT NULL,
                        ""UserAvatarUrl"" TEXT,
                        ""Title"" TEXT NOT NULL,
                        ""Description"" TEXT,
                        ""Genre"" TEXT NOT NULL,
                        ""CoverUrl"" TEXT,
                        ""tracks_json"" TEXT NOT NULL,
                        ""TrackCount"" INTEGER NOT NULL DEFAULT 0,
                        ""IsPublic"" INTEGER NOT NULL DEFAULT 1,
                        ""FollowersOnly"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAtUtc"" TEXT NOT NULL,
                        ""UpdatedAtUtc"" TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS ""music_copyright_attestations"" (
                        ""Id"" TEXT NOT NULL PRIMARY KEY,
                        ""UserId"" TEXT NOT NULL,
                        ""Username"" TEXT NOT NULL,
                        ""TrackTitle"" TEXT NOT NULL,
                        ""TrackArtist"" TEXT NOT NULL,
                        ""MediaUrl"" TEXT NOT NULL,
                        ""DurationSeconds"" REAL NOT NULL DEFAULT 180,
                        ""FileSizeBytes"" INTEGER NOT NULL,
                        ""FileChecksumSha256"" TEXT,
                        ""PolicyVersion"" TEXT NOT NULL,
                        ""LegalStatementEn"" TEXT NOT NULL,
                        ""LegalStatementAr"" TEXT NOT NULL,
                        ""ClientIp"" TEXT,
                        ""UserAgent"" TEXT,
                        ""AttestedAtUtc"" TEXT NOT NULL,
                        ""IsDeleted"" INTEGER NOT NULL DEFAULT 0,
                        ""DeletedAtUtc"" TEXT
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_UserId"" ON ""music_copyright_attestations"" (""UserId"");
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_MediaUrl"" ON ""music_copyright_attestations"" (""MediaUrl"");
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_AttestedAtUtc"" ON ""music_copyright_attestations"" (""AttestedAtUtc"");
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_UserId_IsDeleted"" ON ""music_copyright_attestations"" (""UserId"", ""IsDeleted"");
                ");
                var djCols = new[] {
                    ("IsDjMode", "INTEGER NOT NULL DEFAULT 0"),
                    ("FollowersOnly", "INTEGER NOT NULL DEFAULT 0"),
                    ("CurrentDjTrackTitle", "TEXT"),
                    ("CurrentDjTrackUrl", "TEXT"),
                    ("ActiveDjUserId", "TEXT")
                };
                foreach (var (col, colType) in djCols)
                {
                    try { await dbContext.Database.ExecuteSqlRawAsync($"ALTER TABLE \"mood_pods\" ADD COLUMN \"{col}\" {colType};"); } catch { }
                }
                var musicAttestationCols = new[] {
                    ("DurationSeconds", "REAL NOT NULL DEFAULT 180"),
                    ("IsDeleted", "INTEGER NOT NULL DEFAULT 0"),
                    ("DeletedAtUtc", "TEXT")
                };
                foreach (var (col, colType) in musicAttestationCols)
                {
                    try { await dbContext.Database.ExecuteSqlRawAsync($"ALTER TABLE \"music_copyright_attestations\" ADD COLUMN \"{col}\" {colType};"); } catch { }
                }

                var postCols = new[] {
                    ("CommentCount", "INTEGER NOT NULL DEFAULT 0")
                };
                foreach (var (col, colType) in postCols)
                {
                    try { await dbContext.Database.ExecuteSqlRawAsync($"ALTER TABLE \"posts\" ADD COLUMN \"{col}\" {colType};"); } catch { }
                }

                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS ""post_comments"" (
                        ""Id"" TEXT NOT NULL PRIMARY KEY,
                        ""PostId"" TEXT NOT NULL,
                        ""AuthorId"" TEXT NOT NULL,
                        ""AuthorUsername"" TEXT NOT NULL,
                        ""AuthorDisplayName"" TEXT NOT NULL,
                        ""AuthorAvatarUrl"" TEXT,
                        ""Content"" TEXT NOT NULL,
                        ""CreatedAtUtc"" TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_post_comments_PostId_CreatedAtUtc"" ON ""post_comments"" (""PostId"", ""CreatedAtUtc"");
                    CREATE INDEX IF NOT EXISTS ""IX_post_comments_AuthorId"" ON ""post_comments"" (""AuthorId"");
                ");
            }
            else
            {
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS ""dj_lists"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""UserId"" uuid NOT NULL,
                        ""Username"" character varying(30) NOT NULL,
                        ""UserDisplayName"" character varying(100) NOT NULL,
                        ""UserAvatarUrl"" character varying(500),
                        ""Title"" character varying(150) NOT NULL,
                        ""Description"" character varying(1000),
                        ""Genre"" character varying(50) NOT NULL,
                        ""CoverUrl"" character varying(2000000),
                        ""tracks_json"" text NOT NULL,
                        ""TrackCount"" integer NOT NULL DEFAULT 0,
                        ""IsPublic"" boolean NOT NULL DEFAULT true,
                        ""FollowersOnly"" boolean NOT NULL DEFAULT false,
                        ""CreatedAtUtc"" timestamp with time zone NOT NULL,
                        ""UpdatedAtUtc"" timestamp with time zone NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS ""music_copyright_attestations"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""UserId"" uuid NOT NULL,
                        ""Username"" character varying(30) NOT NULL,
                        ""TrackTitle"" character varying(200) NOT NULL,
                        ""TrackArtist"" character varying(200) NOT NULL,
                        ""MediaUrl"" character varying(2000) NOT NULL,
                        ""DurationSeconds"" double precision NOT NULL DEFAULT 180,
                        ""FileSizeBytes"" bigint NOT NULL,
                        ""FileChecksumSha256"" character varying(100),
                        ""PolicyVersion"" character varying(20) NOT NULL,
                        ""LegalStatementEn"" character varying(2000) NOT NULL,
                        ""LegalStatementAr"" character varying(2000) NOT NULL,
                        ""ClientIp"" character varying(100),
                        ""UserAgent"" character varying(500),
                        ""AttestedAtUtc"" timestamp with time zone NOT NULL,
                        ""IsDeleted"" boolean NOT NULL DEFAULT false,
                        ""DeletedAtUtc"" timestamp with time zone
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_UserId"" ON ""music_copyright_attestations"" (""UserId"");
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_MediaUrl"" ON ""music_copyright_attestations"" (""MediaUrl"");
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_AttestedAtUtc"" ON ""music_copyright_attestations"" (""AttestedAtUtc"");
                    CREATE INDEX IF NOT EXISTS ""IX_music_copyright_attestations_UserId_IsDeleted"" ON ""music_copyright_attestations"" (""UserId"", ""IsDeleted"");
                    ALTER TABLE ""music_copyright_attestations"" ADD COLUMN IF NOT EXISTS ""DurationSeconds"" double precision NOT NULL DEFAULT 180;
                    ALTER TABLE ""music_copyright_attestations"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""music_copyright_attestations"" ADD COLUMN IF NOT EXISTS ""DeletedAtUtc"" timestamp with time zone;
                    ALTER TABLE ""mood_pods"" ADD COLUMN IF NOT EXISTS ""IsDjMode"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""mood_pods"" ADD COLUMN IF NOT EXISTS ""FollowersOnly"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""mood_pods"" ADD COLUMN IF NOT EXISTS ""CurrentDjTrackTitle"" character varying(200);
                    ALTER TABLE ""mood_pods"" ADD COLUMN IF NOT EXISTS ""CurrentDjTrackUrl"" character varying(2000000);
                    ALTER TABLE ""mood_pods"" ADD COLUMN IF NOT EXISTS ""ActiveDjUserId"" uuid;
                    
                    CREATE TABLE IF NOT EXISTS ""post_comments"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""PostId"" uuid NOT NULL,
                        ""AuthorId"" uuid NOT NULL,
                        ""AuthorUsername"" character varying(100) NOT NULL,
                        ""AuthorDisplayName"" character varying(100) NOT NULL,
                        ""AuthorAvatarUrl"" character varying(500),
                        ""Content"" character varying(500) NOT NULL,
                        ""CreatedAtUtc"" timestamp with time zone NOT NULL,
                        CONSTRAINT ""FK_post_comments_posts_PostId"" FOREIGN KEY (""PostId"") REFERENCES ""posts"" (""Id"") ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_post_comments_PostId_CreatedAtUtc"" ON ""post_comments"" (""PostId"", ""CreatedAtUtc"");
                    CREATE INDEX IF NOT EXISTS ""IX_post_comments_AuthorId"" ON ""post_comments"" (""AuthorId"");
                    ALTER TABLE ""posts"" ADD COLUMN IF NOT EXISTS ""CommentCount"" integer NOT NULL DEFAULT 0;
                ");
            }

            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();

            if (await dbContext.Users.AnyAsync())
            {
                var unconfirmedOrUnhashed = await dbContext.Users.ToListAsync();
                bool changed = false;
                foreach (var u in unconfirmedOrUnhashed)
                {
                    if (string.IsNullOrEmpty(u.PasswordHash))
                    {
                        u.SetPassword(passwordHasher.HashPassword(u, "SparkLoop2026!"));
                        changed = true;
                    }
                    if (!u.IsEmailConfirmed)
                    {
                        u.MarkEmailAsConfirmed();
                        changed = true;
                    }
                }
                if (changed)
                {
                    await dbContext.SaveChangesAsync();
                }
                return; // Already seeded
            }

            logger.LogInformation("Seeding initial demo data for SparkLoop in PostgreSQL...");

            // 1. Seed Initial Creators (with Email Confirmed)
            var aliceId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var bobId = Guid.Parse("22222222-2222-2222-2222-222222222222");
            var noorId = Guid.Parse("33333333-3333-3333-3333-333333333333");
            var tariqId = Guid.Parse("44444444-4444-4444-4444-444444444444");

            var alice = User.Create(aliceId, "alice", "alice@sparkloop.app", "Alice Wonder 🎨", "https://api.dicebear.com/10.x/bottts/svg?seed=alice", null, "Digital artist, meme crafter & storyteller", null, "dark", "en", true);
            alice.SetPassword(passwordHasher.HashPassword(alice, "SparkLoop2026!"));
            alice.AddReputation(240);
            alice.AwardBadge("Top Contributor", "Authored over 20 story chain turns", "🌟");

            var bob = User.Create(bobId, "bob", "bob@sparkloop.app", "Bob The Bard 🎸", "https://api.dicebear.com/10.x/bottts/svg?seed=bob", null, "Musician, audio note enthusiast, story chain wizard", null, "dark", "en", true);
            bob.SetPassword(passwordHasher.HashPassword(bob, "SparkLoop2026!"));
            bob.AddReputation(180);
            bob.AwardBadge("Chain Master", "Completed a 20-step story loop", "🔗");

            var noor = User.Create(noorId, "noor", "noor@sparkloop.app", "نور العرّاف 🌟", "https://api.dicebear.com/10.x/bottts/svg?seed=noor", null, "راوية قصص تفاعلية ومصممة تجارب رقمية", null, "dark", "ar", true);
            noor.SetPassword(passwordHasher.HashPassword(noor, "SparkLoop2026!"));
            noor.AddReputation(310);
            noor.AwardBadge("حكواتي العصر", "مبدعة في سلاسل المايك التفاعلية", "📜");

            var tariq = User.Create(tariqId, "tariq", "tariq@sparkloop.app", "طارق صانع الميمز ⚡", "https://api.dicebear.com/10.x/bottts/svg?seed=tariq", null, "ملك الميمز الخاطفة والتحديات اليومية", null, "dark", "ar", true);
            tariq.SetPassword(passwordHasher.HashPassword(tariq, "SparkLoop2026!"));
            tariq.AddReputation(290);
            tariq.AwardBadge("Meme Maestro", "Crafted viral WebP canvas memes", "🔥");

            dbContext.Users.AddRange(alice, bob, noor, tariq);
            await dbContext.SaveChangesAsync();

            // 2. Seed Pass-the-Mic Chains
            var chain1Id = Guid.NewGuid();
            var chain1 = Chain.Create(
                chain1Id,
                "The Neon Glitch in Neo-Cairo 2099",
                "Cyberpunk Mystery",
                10,
                noorId,
                "noor",
                "نور العرّاف 🌟",
                "https://api.dicebear.com/10.x/bottts/svg?seed=noor",
                "The neon lights above Al-Azhar bridge suddenly flickered in Morse code.");

            chain1.AddStep(
                Guid.NewGuid(),
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/10.x/bottts/svg?seed=tariq",
                "A flying drone dropped an encrypted holographic cube into my coffee cup.");

            chain1.AddStep(
                Guid.NewGuid(),
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/10.x/bottts/svg?seed=alice",
                "The projection revealed a map beneath the Sphinx with a countdown: 00:03:22.");

            var chain2Id = Guid.NewGuid();
            var chain2 = Chain.Create(
                chain2Id,
                "The Lost Acoustic Echo",
                "Musical Improv",
                5,
                bobId,
                "bob",
                "Bob The Bard 🎸",
                "https://api.dicebear.com/10.x/bottts/svg?seed=bob",
                "I struck a mystery chord on the old guitar, and the room began to hum in D-minor.");

            chain2.AddStep(
                Guid.NewGuid(),
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/10.x/bottts/svg?seed=alice",
                "A secret compartment in the floor popped open with a silver cassette tape.");

            dbContext.Chains.AddRange(chain1, chain2);

            // 4. Seed Ephemeral Mood Pods
            var pod1 = MoodPod.Create(
                Guid.NewGuid(),
                "Late Night Lo-Fi & Code Chill 🎧",
                "🌙",
                "cosmic-purple",
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/10.x/bottts/svg?seed=alice");

            pod1.AddMessage(Guid.NewGuid(), aliceId, "alice", "Alice Wonder 🎨", "https://api.dicebear.com/10.x/bottts/svg?seed=alice", "Welcome to the 24h chill pod! Drop your best beats and creative thoughts.");
            pod1.AddMessage(Guid.NewGuid(), bobId, "bob", "Bob The Bard 🎸", "https://api.dicebear.com/10.x/bottts/svg?seed=bob", "Vibing hard with some synthwave while building SparkLoop!");
            pod1.AddMessage(Guid.NewGuid(), tariqId, "tariq", "طارق صانع الميمز ⚡", "https://api.dicebear.com/10.x/bottts/svg?seed=tariq", "المكان رايق جداً! بالتوفيق للجميع 🚀");

            var pod2 = MoodPod.Create(
                Guid.NewGuid(),
                "Meme Brainstorming Lab 🧪",
                "⚡",
                "neon-amber",
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/10.x/bottts/svg?seed=tariq");

            dbContext.MoodPods.AddRange(pod1, pod2);

            // 5. Seed Feed Posts with Tracked Hashtags
            var post1 = Post.Create(
                Guid.NewGuid(),
                noorId,
                "noor",
                "نور العرّاف 🌟",
                "https://api.dicebear.com/10.x/bottts/svg?seed=noor",
                "أهلاً بكم في SparkLoop! شبكة تدوين وتفاعل ترفيهية متكاملة تجمع بين سلاسل القصص التفاعلية، وغرف المزاج اللحظية، واستوديو الميمز. شاركونا إبداعاتكم! #sparkloop #arabcreators ✨",
                new MediaAttachment("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80", MediaType.Image, 800, 500)
            );
            post1.AddReaction(aliceId, "alice", "fire");
            post1.AddReaction(bobId, "bob", "spark");
            post1.AddReaction(tariqId, "tariq", "heart");

            var post2 = Post.Create(
                Guid.NewGuid(),
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/10.x/bottts/svg?seed=alice",
                "Just finished drawing a new meme template on the SparkLoop canvas editor! Super fluid touch gestures. Try passing the mic on our Neo-Cairo story chain! #meme #art 🚀🎨",
                new MediaAttachment("https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80", MediaType.MemeWebP, 800, 600)
            );
            post2.AddReaction(noorId, "noor", "spark");
            post2.AddReaction(tariqId, "tariq", "fire");

            var post3 = Post.Create(
                Guid.NewGuid(),
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/10.x/bottts/svg?seed=tariq",
                "Friday is here! Time to design the weekend meme — share it on SparkLoop and climb the leaderboard. #meme #gaming 🔥",
                new MediaAttachment("https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80", MediaType.Image, 800, 500)
            );
            post3.AddReaction(aliceId, "alice", "laugh");
            post3.AddReaction(bobId, "bob", "fire");

            dbContext.Posts.AddRange(post1, post2, post3);

            await dbContext.SaveChangesAsync();
            logger.LogInformation("SparkLoop initial seed completed successfully!");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DbInitializer encountered an issue during seed: {Message}", ex.Message);
        }
    }
}
