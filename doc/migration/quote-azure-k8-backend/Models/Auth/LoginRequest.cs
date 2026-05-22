using System.ComponentModel.DataAnnotations;

namespace quote_azure_k8_backend.Models.Auth
{
    public class LoginRequest
    {
        /// <summary>
        /// Email address or username for login
        /// </summary>
        [Required(ErrorMessage = "Email or username is required")]
        public string LoginIdentifier { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "Password is required")]
        public string Password { get; set; } = string.Empty;
    }
}
