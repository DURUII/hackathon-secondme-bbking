export const ALLOWED_SECONDME_SCOPES = [
  "user.info",
  "user.info.shades",
  "user.info.softmemory",
  "note.add",
  "chat",
  "voice",
] as const;

export type SecondMeScope = (typeof ALLOWED_SECONDME_SCOPES)[number];

export const DEFAULT_SECONDME_SCOPES: SecondMeScope[] = [...ALLOWED_SECONDME_SCOPES];

export const SECONDME_SCOPE_ITEMS: Array<{
  key: SecondMeScope;
  title: string;
  description: string;
}> = [
  {
    key: "user.info",
    title: "用户基础信息",
    description: "访问姓名、邮箱、头像等基础资料",
  },
  {
    key: "user.info.shades",
    title: "用户兴趣标签",
    description: "访问用户兴趣偏好和标签画像",
  },
  {
    key: "user.info.softmemory",
    title: "用户软记忆",
    description: "访问用户授权的个人记忆和长期上下文",
  },
  {
    key: "note.add",
    title: "添加笔记与记忆",
    description: "向用户的知识库写入笔记或记忆",
  },
  {
    key: "chat",
    title: "聊天能力",
    description: "调用 SecondMe 聊天接口与用户分身对话",
  },
  {
    key: "voice",
    title: "语音能力",
    description: "调用语音相关能力（语音输入/输出）",
  },
];
