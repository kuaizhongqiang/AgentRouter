package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/opencode-ai/opencode/internal/app"
	"github.com/opencode-ai/opencode/internal/config"
	"github.com/opencode-ai/opencode/internal/db"
	"github.com/opencode-ai/opencode/internal/llm/agent"
	"github.com/spf13/cobra"
)

// NDJSON 协议事件
type PlatformEvent struct {
	ProtocolVersion string                 `json:"protocol_version"`
	ID              string                 `json:"id"`
	SessionID       string                 `json:"session_id"`
	Type            string                 `json:"type"`
	Event           string                 `json:"event"`
	Data            map[string]interface{} `json:"data"`
	Timestamp       string                 `json:"timestamp"`
}

func emitEvent(sessionID, event string, data map[string]interface{}) {
	e := PlatformEvent{
		ProtocolVersion: "1.0",
		ID:              uuid.New().String(),
		SessionID:       sessionID,
		Type:            "event",
		Event:           event,
		Data:            data,
		Timestamp:       time.Now().UTC().Format(time.RFC3339Nano),
	}
	b, _ := json.Marshal(e)
	fmt.Fprintln(os.Stdout, string(b))
}

var platformCmd = &cobra.Command{
	Use:   "platform exec <command>",
	Short: "AgentRouter platform integration mode",
	Long: `Run opencode in platform mode for AgentRouter integration.
Emits NDJSON events to stdout following the AgentRouter protocol.

Usage:
  ar-opencode platform exec "<command>"    Run a command and emit NDJSON events
  ar-opencode platform doctor              Run diagnostics
  ar-opencode --version                    Print version`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return fmt.Errorf("platform requires a subcommand: exec or doctor")
		}

		sub := args[0]

		if sub == "doctor" {
			// 快速诊断
			diag := map[string]interface{}{
				"version": "0.1.0",
				"status":  "ok",
			}
			b, _ := json.Marshal(diag)
			fmt.Fprintln(os.Stdout, string(b))
			return nil
		}

		if sub != "exec" {
			return fmt.Errorf("unknown platform subcommand: %s (expected: exec, doctor)", sub)
		}

		// 收集命令文本
		command := ""
		if len(args) > 1 {
			command = args[1]
		}
		if command == "" {
			return fmt.Errorf("platform exec requires a command argument")
		}

		sessionID := uuid.New().String()
		emitEvent(sessionID, "task:start", map[string]interface{}{
			"command":     command,
			"projectRoot": getCwd(),
		})

		// 初始化 App（复用非交互模式的初始化流程）
		cwd := getCwd()
		debug := false // platform 模式默认无调试

		_, err := config.Load(cwd, debug)
		if err != nil {
			emitEvent(sessionID, "error", map[string]interface{}{
				"error": fmt.Sprintf("config load failed: %v", err),
			})
			return err
		}

		conn, err := db.Connect()
		if err != nil {
			emitEvent(sessionID, "error", map[string]interface{}{
				"error": fmt.Sprintf("db connect failed: %v", err),
			})
			return err
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		appInstance, err := app.New(ctx, conn)
		if err != nil {
			emitEvent(sessionID, "error", map[string]interface{}{
				"error": fmt.Sprintf("app init failed: %v", err),
			})
			return err
		}
		defer appInstance.Shutdown()

		// 自动审批权限
		appInstance.Permissions.AutoApproveSession(sessionID)

		// 订阅 agent 事件以生成 NDJSON progress 事件
		eventCh := appInstance.CoderAgent.Subscribe(ctx)
		agentDone := make(chan error, 1)

		go func() {
			defer close(agentDone)
			for {
				select {
				case <-ctx.Done():
					agentDone <- ctx.Err()
					return
				case evt, ok := <-eventCh:
					if !ok {
						return
					}
					payload := evt.Payload
					switch payload.Type {
					case agent.AgentEventTypeResponse:
						msg := payload.Message
						content := msg.Content().String()
						reasoning := msg.ReasoningContent().Thinking
						if reasoning != "" {
							emitEvent(sessionID, "progress", map[string]interface{}{
								"channel": "reasoning",
								"content": reasoning,
							})
						}
						if content != "" {
							emitEvent(sessionID, "progress", map[string]interface{}{
								"type":    "assistant_message",
								"content": content,
							})
						}
						// 事件处理完毕，通知主 goroutine 可以发 completion 了
						agentDone <- nil
					case agent.AgentEventTypeError:
						if payload.Error != nil {
							emitEvent(sessionID, "error", map[string]interface{}{
								"error": payload.Error.Error(),
							})
							agentDone <- payload.Error
						}
					}
				}
			}
		}()

		// 创建会话并运行
		sess, err := appInstance.Sessions.Create(ctx, "Platform: "+command)
		if err != nil {
			emitEvent(sessionID, "error", map[string]interface{}{
				"error": fmt.Sprintf("session create failed: %v", err),
			})
			return err
		}
		realSessionID := sess.ID
		emitEvent(sessionID, "progress", map[string]interface{}{
			"type":       "session_created",
			"session_id": realSessionID,
		})

		_, err = appInstance.CoderAgent.Run(ctx, realSessionID, command)
		if err != nil {
			emitEvent(sessionID, "error", map[string]interface{}{
				"error": fmt.Sprintf("agent run failed: %v", err),
			})
			return err
		}

		// 等待订阅 goroutine 处理完 agent 事件后再发 completion
		if agentErr := <-agentDone; agentErr != nil {
			emitEvent(sessionID, "completion", map[string]interface{}{
				"session_id": realSessionID,
				"status":     "completed",
			})
			return agentErr
		}

		emitEvent(sessionID, "completion", map[string]interface{}{
			"session_id": realSessionID,
			"status":     "completed",
		})

		return nil
	},
}

func getCwd() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return cwd
}

func init() {
	rootCmd.AddCommand(platformCmd)
}
