using System.ComponentModel.DataAnnotations;

namespace quote_azure_k8_backend.Models.Auth
{
    public class UpdateRoleRequest
    {
        [Required(ErrorMessage = "Username is required")]
        public string username { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "Role is required")]
        public string role { get; set; } = string.Empty;
    }
}
