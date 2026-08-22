namespace Application.Tests.Integration;

/// <summary>
/// Forces every test class that boots WebApplicationFactory&lt;Program&gt;
/// to run sequentially rather than in parallel across classes (xUnit's
/// default collection behavior). Required by JwtStartupValidationTests
/// (code-review finding, 2026-08-22), which mutates process-wide Jwt:*
/// environment variables to force Program.cs's pre-Build() config guards to
/// fire — those guards run before WebApplicationFactory's own
/// ConfigureAppConfiguration hook takes effect, so environment variables are
/// the only override visible to them, and env vars are global process
/// state another class's concurrently-booting factory could pick up.
/// </summary>
[CollectionDefinition("WebApplicationFactory", DisableParallelization = true)]
public class WebApplicationFactoryCollection;
