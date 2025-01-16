"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_decorator_1 = require("../decorators/roles.decorator");
class RolesGuard {
    constructor() {
        this.reflector = new core_1.Reflector();
    }
    async canActivate(context) {
        const roles = this.reflector.get(roles_decorator_1.ROLES_KEY, context.getHandler());
        if (!roles) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('Access Denied: No user information');
        }
        const hasRole = roles.some(role => user.role === role);
        if (!hasRole) {
            throw new common_1.ForbiddenException('Access Denied: Insufficient role');
        }
        return true;
    }
}
exports.RolesGuard = RolesGuard;
//# sourceMappingURL=roles.guard.js.map