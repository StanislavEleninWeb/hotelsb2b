import { IsUUID } from 'class-validator';

export class AssignRoomDto {
  @IsUUID()
  roomId!: string;
}
