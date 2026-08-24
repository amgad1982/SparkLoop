using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Aggregates.MoodPodAggregate;
using SparkLoop.Domain.Aggregates.PostAggregate;
using SparkLoop.Domain.Aggregates.SparkAggregate;
using SparkLoop.Domain.Aggregates.UserAggregate;
using SparkLoop.Infrastructure.Persistence;

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
            await dbContext.Database.EnsureCreatedAsync();

            if (await dbContext.Users.AnyAsync())
            {
                return; // Already seeded
            }

            logger.LogInformation("Seeding initial demo data for SparkLoop...");

            // 1. Seed Personas
            var aliceId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var bobId = Guid.Parse("22222222-2222-2222-2222-222222222222");
            var noorId = Guid.Parse("33333333-3333-3333-3333-333333333333");
            var tariqId = Guid.Parse("44444444-4444-4444-4444-444444444444");

            var alice = User.Create(aliceId, "alice", "alice@sparkloop.app", "Alice Wonder 🎨", "https://api.dicebear.com/7.x/bottts/svg?seed=alice", "Digital artist, meme crafter & storyteller");
            alice.AddReputation(240);
            alice.AwardBadge("Spark Champion", "Winner of the Daily Spark Challenge", "🏆");
            alice.AwardBadge("Top Contributor", "Authored over 20 story chain turns", "🌟");

            var bob = User.Create(bobId, "bob", "bob@sparkloop.app", "Bob The Bard 🎸", "https://api.dicebear.com/7.x/bottts/svg?seed=bob", "Musician, audio note enthusiast, story chain wizard");
            bob.AddReputation(180);
            bob.AwardBadge("Chain Master", "Completed a 20-step story loop", "🔗");

            var noor = User.Create(noorId, "noor", "noor@sparkloop.app", "نور العرّاف 🌟", "https://api.dicebear.com/7.x/bottts/svg?seed=noor", "راوية قصص تفاعلية ومصممة تجارب رقمية");
            noor.AddReputation(310);
            noor.AwardBadge("حكواتي العصر", "مبدعة في سلاسل المايك التفاعلية", "📜");

            var tariq = User.Create(tariqId, "tariq", "tariq@sparkloop.app", "طارق صانع الميمز ⚡", "https://api.dicebear.com/7.x/bottts/svg?seed=tariq", "ملك الميمز الخاطفة والتحديات اليومية");
            tariq.AddReputation(290);
            tariq.AwardBadge("Meme Maestro", "Crafted viral WebP canvas memes", "🔥");

            dbContext.Users.AddRange(alice, bob, noor, tariq);
            await dbContext.SaveChangesAsync();

            // 2. Seed Daily Spark
            var sparkId = Guid.NewGuid();
            var spark = Spark.Create(
                sparkId,
                "🔥 Friday Meme Mania: Developer Life in 2026",
                "Craft or draw a meme showing how you handle production bugs at 5 PM on a Friday. Best meme wins the Spark Champion badge!",
                "Meme Challenge",
                DateTime.UtcNow,
                TimeSpan.FromHours(24));

            var sub1 = spark.SubmitEntry(
                Guid.NewGuid(),
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/7.x/bottts/svg?seed=tariq",
                "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80",
                "When CI/CD turns red 2 minutes before the weekend: Deploy directly to prod and turn off notifications! 🚀");
            sub1.AddVote(aliceId);
            sub1.AddVote(bobId);

            var sub2 = spark.SubmitEntry(
                Guid.NewGuid(),
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/7.x/bottts/svg?seed=alice",
                "https://images.unsplash.com/photo-1534972195531-a756b1126f24?w=600&auto=format&fit=crop&q=80",
                "My code when it works vs when the senior architect reviews it 😅");
            sub2.AddVote(noorId);

            dbContext.Sparks.Add(spark);

            // 3. Seed Pass-the-Mic Chains
            var chain1Id = Guid.NewGuid();
            var chain1 = Chain.Create(
                chain1Id,
                "The Neon Glitch in Neo-Cairo 2099",
                "Cyberpunk Mystery",
                10,
                noorId,
                "noor",
                "نور العرّاف 🌟",
                "https://api.dicebear.com/7.x/bottts/svg?seed=noor",
                "The neon lights above Al-Azhar bridge suddenly flickered in Morse code.");

            chain1.AddStep(
                Guid.NewGuid(),
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/7.x/bottts/svg?seed=tariq",
                "A flying drone dropped an encrypted holographic cube into my coffee cup.");

            chain1.AddStep(
                Guid.NewGuid(),
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/7.x/bottts/svg?seed=alice",
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
                "https://api.dicebear.com/7.x/bottts/svg?seed=bob",
                "I struck a mystery chord on the old guitar, and the room began to hum in D-minor.");

            chain2.AddStep(
                Guid.NewGuid(),
                aliceId,
                "alice",
                "Alice Wonder 🎨",
                "https://api.dicebear.com/7.x/bottts/svg?seed=alice",
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
                "https://api.dicebear.com/7.x/bottts/svg?seed=alice");

            pod1.AddMessage(Guid.NewGuid(), aliceId, "alice", "Alice Wonder 🎨", "https://api.dicebear.com/7.x/bottts/svg?seed=alice", "Welcome to the 24h chill pod! Drop your best beats and creative thoughts.");
            pod1.AddMessage(Guid.NewGuid(), bobId, "bob", "Bob The Bard 🎸", "https://api.dicebear.com/7.x/bottts/svg?seed=bob", "Vibing hard with some synthwave while building SparkLoop!");
            pod1.AddMessage(Guid.NewGuid(), tariqId, "tariq", "طارق صانع الميمز ⚡", "https://api.dicebear.com/7.x/bottts/svg?seed=tariq", "المكان رايق جداً! بالتوفيق للجميع 🚀");

            var pod2 = MoodPod.Create(
                Guid.NewGuid(),
                "Meme Brainstorming Lab 🧪",
                "⚡",
                "neon-amber",
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/7.x/bottts/svg?seed=tariq");

            dbContext.MoodPods.AddRange(pod1, pod2);

            // 5. Seed Feed Posts with Tracked Hashtags
            var post1 = Post.Create(
                Guid.NewGuid(),
                noorId,
                "noor",
                "نور العرّاف 🌟",
                "https://api.dicebear.com/7.x/bottts/svg?seed=noor",
                "أهلاً بكم في SparkLoop! شبكة تدوين وتفاعل ترفيهية متكاملة تجمع بين سلاسل القصص التفاعلية، وتحديات السبارك اليومية. شاركونا إبداعاتكم! #sparkloop #arabcreators ✨",
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
                "https://api.dicebear.com/7.x/bottts/svg?seed=alice",
                "Just finished drawing a new meme template on the SparkLoop canvas editor! Super fluid touch gestures. Try passing the mic on our Neo-Cairo story chain! #meme #art #spark 🚀🎨",
                new MediaAttachment("https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80", MediaType.MemeWebP, 800, 600)
            );
            post2.AddReaction(noorId, "noor", "spark");
            post2.AddReaction(tariqId, "tariq", "fire");

            var post3 = Post.Create(
                Guid.NewGuid(),
                tariqId,
                "tariq",
                "طارق صانع الميمز ⚡",
                "https://api.dicebear.com/7.x/bottts/svg?seed=tariq",
                "تحدي اليوم مولع! صمموا أفضل ميم عن الجمعة وشاركوا في السبارك للفوز بالوسم الذهبي. #spark #meme #gaming 🔥",
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
