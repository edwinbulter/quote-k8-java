using Microsoft.AspNetCore.Mvc;
using quote_azure_k8_backend.Services;

namespace quote_azure_k8_backend.Controllers
{
    [ApiController]
    [Route("api")]
    public class SeedController : ControllerBase
    {
        private readonly AdminUserSeeder _seeder;

        public SeedController(AdminUserSeeder seeder)
        {
            _seeder = seeder;
        }

        /// <summary>
        /// Seed users (run once to create admin and test users)
        /// </summary>
        [HttpPost("seed-users")]
        public async Task<ActionResult> SeedUsers()
        {
            try
            {
                await _seeder.SeedAdminUsersAsync();
                return Ok("Users seeded successfully");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while seeding users");
            }
        }
    }
}
