using System.ComponentModel.DataAnnotations;

namespace quote_azure_k8_backend.Models.Auth
{
    public class UnregisterRequest
    {
        [Required(ErrorMessage = "Password is required")]
        public string Password { get; set; } = string.Empty;
    }
}
